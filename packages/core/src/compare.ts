import type { CompareProductsInput, CompareProductsOutput, InventoryStatus } from "@veylo/types";
import type { CompareAssistResult } from "./assist";
import type { CatalogProduct } from "./catalog";
import type { CoreContext, LedgerEntry } from "./context";
import { tokenize } from "./text";
import { normalize } from "./text";

const LEDGER_WINDOW_MS = 6 * 60 * 60 * 1000;
const KNOWN_REQUIREMENTS = ["compatibility", "extraPorts", "urgency"];

interface Requirements {
  compatibility?: string;
  extraPorts?: boolean;
  urgency?: string;
  ignored: string[];
}

function parseRequirements(raw: Record<string, unknown> | undefined): Requirements {
  const r = raw ?? {};
  return {
    compatibility: typeof r.compatibility === "string" && r.compatibility.trim() ? r.compatibility : undefined,
    extraPorts: typeof r.extraPorts === "boolean" ? r.extraPorts : undefined,
    urgency: typeof r.urgency === "string" ? r.urgency : undefined,
    ignored: Object.keys(r).filter((k) => !KNOWN_REQUIREMENTS.includes(k)),
  };
}

interface Row {
  name: string;
  product?: CatalogProduct;
  pros: string[]; // catalogue-derived
  cons: string[]; // catalogue-derived
  evidencePro?: string;
  evidenceCon?: string;
  availability: InventoryStatus;
  distanceMeters?: number;
  score: number;
  reason: "stock" | "compatibility" | "none";
}

const km = (m: number) => `${(m / 1000).toFixed(1)} km`;

function assess(product: CatalogProduct, req: Requirements, entry: LedgerEntry | undefined): Row {
  const pros: string[] = [];
  const cons: string[] = [];
  let score = 0;
  let reason: Row["reason"] = "none";
  if (product.useCases[0]) pros.push(product.useCases[0]);
  for (const note of product.compatibility) cons.push(`Check: ${note}`);

  if (req.compatibility) {
    const wanted = tokenize(req.compatibility);
    const hay = new Set(
      tokenize([product.name, ...product.aliases.map((a) => a.text), ...product.compatibility,
        ...Object.values(product.attributes).flat().map(String)].join(" ")),
    );
    const hits = wanted.filter((t) => hay.has(t));
    if (wanted.length > 0 && hits.length === wanted.length) {
      pros.push(`Catalogue entry mentions your stated compatibility (${req.compatibility}).`);
      score += 2;
      reason = "compatibility";
    } else if (hits.length === 0) {
      cons.push(`Nothing in the catalogue shows it fits "${req.compatibility}".`);
      score -= 1;
    }
  }
  if (req.extraPorts) {
    const ports = Array.isArray(product.attributes.ports) ? product.attributes.ports.map(String) : [];
    if (ports.length > 1) { pros.push(`Includes extra ports: ${ports.join(", ")}.`); score += 2; }
    else { cons.push("No extra ports."); score -= 1; }
  }

  const status = entry?.status ?? "UNKNOWN";
  const weight = req.urgency === "today" ? 1.5 : 1;
  const where = entry ? `${entry.store}${entry.distanceMeters !== undefined ? `, ${km(entry.distanceMeters)} away` : ""}` : "";
  let evidencePro: string | undefined;
  let evidenceCon: string | undefined;
  if (req.urgency !== "online") {
    if (status === "CONFIRMED") { evidencePro = `Stock confirmed at ${where}.`; score += 3 * weight; reason = "stock"; }
    else if (status === "LIKELY") { evidencePro = `Likely available at ${where} (not confirmed).`; score += 2 * weight; reason = "stock"; }
    else if (status === "WEB_FOUND") { evidencePro = `Mentioned on the web for ${where}; not confirmed.`; score += 1 * weight; reason = "stock"; }
    else evidenceCon = "No stock evidence has been gathered for it yet.";
  }
  return { name: product.name, product, pros, cons, evidencePro, evidenceCon, availability: status, distanceMeters: entry?.distanceMeters, score, reason };
}

function recommendationFor(best: Row): string {
  const why =
    best.reason === "stock"
      ? best.availability === "CONFIRMED"
        ? "stock there is confirmed"
        : "its availability evidence is the strongest so far, though stock is not confirmed"
    : best.reason === "compatibility" ? "it best matches your stated compatibility"
    : "nothing yet separates the options, so this is the first one you listed";
  return `${best.name} looks like the best fit because ${why}.`;
}

function applyAssist(rows: Row[], result: CompareAssistResult): string {
  const resolved = rows.filter((r) => r.product);
  const names = resolved.map((r) => r.name.toLowerCase());
  if (!result.recommendation?.trim() || !names.some((n) => result.recommendation.toLowerCase().includes(n))) {
    throw new Error("assist recommendation does not name a compared product");
  }
  if (!result.reasoningSummary?.trim()) throw new Error("assist returned no reasoning summary");
  for (const note of result.notes ?? []) {
    const row = resolved.find((r) => r.name.toLowerCase() === String(note.product).toLowerCase());
    if (!row) continue;
    const clean = (xs: unknown) => (Array.isArray(xs) ? xs.filter((x): x is string => typeof x === "string" && x.trim() !== "") : []);
    const pros = clean(note.pros);
    const cons = clean(note.cons);
    if (pros.length > 0) row.pros = pros;
    if (cons.length > 0) row.cons = cons;
  }
  return result.recommendation.trim();
}

export async function compareProducts(ctx: CoreContext, input: CompareProductsInput): Promise<CompareProductsOutput> {
  const index = await ctx.catalog.get();
  const now = ctx.clock?.() ?? new Date();
  const req = parseRequirements(input.userRequirements);
  const searchLocation = input.location ? normalize(input.location) : undefined;
  const since = new Date(now.getTime() - LEDGER_WINDOW_MS).toISOString();

  const rows: Row[] = [];
  for (const name of input.products) {
    const product = index.resolve(name);
    if (!product) {
      rows.push({ name, pros: [], cons: ["Not in the Veylo catalogue, so there is no comparison data for it."], availability: "UNKNOWN", score: -5, reason: "none" });
      continue;
    }
    rows.push(assess(product, req, await ctx.ledger.bestFor(product.name, { searchLocation, since })));
  }

  const resolved = rows.filter((r) => r.product);
  const noteIgnored = req.ignored.length > 0 ? ` Not evaluated: ${req.ignored.join(", ")}.` : "";
  const baseReasoning =
    "Compared using catalogue compatibility notes and attributes, plus stock evidence gathered in this session. " +
    `Prices are not compared: Veylo has no verified price source.${noteIgnored}`;
  if (resolved.length === 0) {
    return {
      recommendation: "I could not compare these: none of them are in the Veylo catalogue.",
      reasoningSummary: baseReasoning,
      comparison: rows.map(finish),
      meta: { provider: "rules" },
    };
  }

  const best = resolved.reduce((a, b) => (b.score > a.score ? b : a));
  let recommendation = recommendationFor(best);
  let reasoningSummary = baseReasoning;
  let meta: NonNullable<CompareProductsOutput["meta"]> = { provider: "rules" };

  const assist = ctx.compareAssist;
  if (assist) {
    const started = Date.now();
    const snapshot = rows.map((r) => ({ pros: r.pros, cons: r.cons }));
    try {
      const result = await assist.compare({
        products: resolved.map((r) => ({
          name: r.name, category: r.product!.category, description: r.product!.description,
          compatibility: r.product!.compatibility, attributes: r.product!.attributes,
          availability: r.availability, distanceMeters: r.distanceMeters,
        })),
        requirements: input.userRequirements,
        location: input.location,
      });
      recommendation = applyAssist(rows, result);
      reasoningSummary = `${result.reasoningSummary.trim()} ${baseReasoning}`;
      meta = { provider: assist.provider, modelId: assist.modelId, latencyMs: Date.now() - started };
    } catch (err) {
      rows.forEach((r, i) => { r.pros = snapshot[i]!.pros; r.cons = snapshot[i]!.cons; });
      const reason = err instanceof Error ? err.message : String(err);
      ctx.logger?.warn("compare assist failed; using rules result", { provider: assist.provider, reason });
      meta = { provider: "rules", fallbackFrom: assist.provider, fallbackReason: reason, latencyMs: Date.now() - started };
    }
  }
  return { recommendation, reasoningSummary, comparison: rows.map(finish), meta };
}

/** Availability and distance always come from collected evidence, never from an AI provider. */
function finish(r: Row): CompareProductsOutput["comparison"][number] {
  return {
    product: r.name,
    pros: [...r.pros, ...(r.evidencePro ? [r.evidencePro] : [])],
    cons: [...r.cons, ...(r.evidenceCon ? [r.evidenceCon] : [])],
    availability: r.availability,
    distanceMeters: r.distanceMeters,
  };
}
