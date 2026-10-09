import type { CheckLocalInventoryInput, CheckLocalInventoryOutput, Evidence, InventoryStatus } from "@veylo/types";
import type { CatalogProduct } from "./catalog";
import type { CoreContext, InventorySignal, Place } from "./context";
import { VeyloError } from "./errors";
import { STORE_TYPE_LABEL, storeWeightsForCategory } from "./store-categories";
import { clamp, round2 } from "./util";

const DAY_MS = 24 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;
/** Only these can establish current stock. A web page claiming "in stock" is never enough. */
const STOCK_SOURCES = new Set<InventorySignal["sourceType"]>(["store", "api", "user"]);
/** Minimum store-type fit before a first-party listing is treated as strong relevance (LIKELY). */
const STRONG_RELEVANCE = 0.6;

// Ordinal heuristics, NOT calibrated probabilities: base + span * relevance per status.
const CONFIDENCE: Record<Exclude<InventoryStatus, "CONFIRMED">, [base: number, span: number]> = {
  UNKNOWN: [0.1, 0.2],
  WEB_FOUND: [0.35, 0.2],
  LIKELY: [0.55, 0.25],
};

export interface AssessArgs {
  place: Place;
  product: string;
  /** Category fit of the store type for this product (0..1); undefined if the product is not in the catalogue. */
  relevance?: number;
  productCategory?: string;
  signals: InventorySignal[];
  now: Date;
  confirmedMaxAgeMs?: number;
}

function nextAction(status: InventoryStatus, place: Place): string {
  const contact = place.phone
    ? `Call ${place.name} on ${place.phone}`
    : place.website
      ? `Check ${place.name}'s website or visit (no phone number is listed)`
      : `Visit ${place.name} or look for contact details elsewhere (none are listed)`;
  switch (status) {
    case "CONFIRMED":
      return `${contact} to hold the item if you can, then go.`;
    case "LIKELY":
      return `${contact} to confirm current stock before travelling.`;
    case "WEB_FOUND":
      return `A web source mentions this, but that does not show it is on the shelf. ${contact} to confirm.`;
    default:
      return `No product-specific evidence yet. ${contact} to ask whether they stock it.`;
  }
}

/**
 * Pure trust decision. A store type match alone can never exceed UNKNOWN:
 *  CONFIRMED  fresh in-stock signal from a store, API or user report
 *  LIKELY     strong store-type fit AND a first-party listing of the product
 *  WEB_FOUND  a web source mentions the product at this business
 *  UNKNOWN    everything else
 */
export function assessInventory(a: AssessArgs): CheckLocalInventoryOutput {
  const nowMs = a.now.getTime();
  const maxAge = a.confirmedMaxAgeMs ?? DAY_MS;
  const age = (s: InventorySignal) => nowMs - Date.parse(s.timestamp);
  const fresh = (s: InventorySignal) => {
    const t = age(s);
    return Number.isFinite(t) && t <= maxAge && t >= -CLOCK_SKEW_MS;
  };

  const evidence: Evidence[] = [];
  if (a.relevance !== undefined && a.relevance > 0) {
    evidence.push({
      source: a.place.source,
      sourceType: a.place.sourceType,
      timestamp: a.place.retrievedAt,
      confidence: round2(a.relevance),
      evidenceSummary: `Listed in ${a.place.source} as "${STORE_TYPE_LABEL[a.place.storeType]}". This store type usually carries ${a.productCategory ?? "this kind of product"} (fit ${round2(a.relevance)}). This does not show the product is in stock.`,
    });
  }
  for (const s of a.signals) {
    evidence.push({
      source: s.source,
      sourceType: s.sourceType,
      timestamp: s.timestamp,
      confidence: clamp(s.confidence),
      evidenceSummary: s.summary,
    });
  }

  const confirmedSignal = a.signals.find((s) => s.kind === "in_stock_confirmed" && STOCK_SOURCES.has(s.sourceType) && fresh(s));
  // A stale or web-sourced stock claim degrades to a listing; it cannot confirm anything.
  const listings = a.signals.filter(
    (s) => s !== confirmedSignal && (s.kind === "product_listed" || s.kind === "in_stock_confirmed"),
  );
  const firstPartyListing = listings.some((s) => s.firstParty || s.sourceType === "store" || s.sourceType === "api");
  const relevance = a.relevance ?? 0;

  let status: InventoryStatus = "UNKNOWN";
  if (confirmedSignal) status = "CONFIRMED";
  else if (relevance >= STRONG_RELEVANCE && firstPartyListing) status = "LIKELY";
  else if (a.signals.some((s) => s.sourceType === "web")) status = "WEB_FOUND";

  const confidence =
    status === "CONFIRMED"
      ? round2(clamp(Math.max(0.9, confirmedSignal?.confidence ?? 0), 0, 0.99))
      : round2(CONFIDENCE[status][0] + CONFIDENCE[status][1] * relevance);

  return { store: a.place.name, product: a.product, status, confidence, evidence, nextAction: nextAction(status, a.place) };
}

export function relevanceFor(place: Place, product: CatalogProduct): number {
  return storeWeightsForCategory(product.category, product.parentCategory).get(place.storeType) ?? 0;
}

export async function checkLocalInventory(
  ctx: CoreContext,
  input: CheckLocalInventoryInput,
): Promise<CheckLocalInventoryOutput> {
  const place = await ctx.placeStore.get(input.storeId);
  if (!place) {
    throw new VeyloError("NOT_FOUND", `Unknown storeId "${input.storeId}". Run discover_local_places first.`, {
      storeId: input.storeId,
    });
  }
  const index = await ctx.catalog.get();
  const resolved = index.resolve(input.product);
  const productName = resolved?.name ?? input.product;

  const settled = await Promise.allSettled(ctx.evidenceProviders.map((p) => p.lookup({ place, product: productName })));
  const signals: InventorySignal[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") signals.push(...r.value);
    else ctx.logger?.warn("inventory evidence provider failed", { provider: ctx.evidenceProviders[i]?.name, reason: String(r.reason) });
  });

  const now = ctx.clock?.() ?? new Date();
  const result = assessInventory({
    place,
    product: productName,
    relevance: resolved ? relevanceFor(place, resolved) : undefined,
    productCategory: resolved?.category,
    signals,
    now,
    confirmedMaxAgeMs: ctx.options?.confirmedMaxAgeMs,
  });
  await ctx.ledger.record({
    placeId: place.id,
    store: place.name,
    product: productName,
    status: result.status,
    confidence: result.confidence,
    distanceMeters: place.distanceMeters,
    searchLocation: place.searchLocation,
    at: now.toISOString(),
  });
  return result;
}
