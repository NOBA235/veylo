import type { DiscoverLocalPlacesInput, DiscoverLocalPlacesOutput } from "@veylo/types";
import type { CatalogIndex } from "./catalog-index";
import type { CoreContext, Place } from "./context";
import { VeyloError } from "./errors";
import { haversineMeters, parseLatLon } from "./geo";
import { STORE_TYPE_LABEL, parseStoreHints, storeWeightsForCategory, type StoreType } from "./store-categories";
import { normalize } from "./text";
import { round2 } from "./util";

const DEFAULT_RADIUS_M = 5000;
const DEFAULT_MAX_PLACES = 10;
// Ordering blends category fit with proximity. relevanceScore itself is fit only.
const FIT_WEIGHT = 0.7;
const PROXIMITY_WEIGHT = 0.3;

function resolveWeights(
  index: CatalogIndex,
  input: DiscoverLocalPlacesInput,
  productCategory: string | undefined,
): Map<StoreType, number> {
  const hinted = parseStoreHints(input.storeCategories ?? []);
  if (hinted.length > 0) return new Map(hinted.map((t) => [t, 1]));
  for (const category of [input.category, productCategory]) {
    if (!category) continue;
    const weights = storeWeightsForCategory(category, index.parentCategoryOf(category));
    if (weights.size > 0) return weights;
  }
  return new Map();
}

export async function discoverLocalPlaces(
  ctx: CoreContext,
  input: DiscoverLocalPlacesInput,
): Promise<DiscoverLocalPlacesOutput> {
  const radius = input.radiusMeters ?? ctx.options?.defaultRadiusMeters ?? DEFAULT_RADIUS_M;
  const center = parseLatLon(input.location) ?? (await ctx.geocoder.geocode(input.location));
  if (!center) {
    throw new VeyloError("GEOCODE_FAILED", `Could not find a location for "${input.location}".`, { location: input.location });
  }

  const index = await ctx.catalog.get();
  if (ctx.placeSources.length === 0) {
    throw new VeyloError("NOT_CONFIGURED", "No place source is configured, so nearby stores cannot be looked up.");
  }
  const product = index.resolve(input.product);
  const weights = resolveWeights(index, input, product?.category);
  if (weights.size === 0) {
    throw new VeyloError(
      "UNKNOWN_CATEGORY",
      `Cannot tell which kinds of store sell "${input.product}". Pass a catalogue category or storeCategories.`,
      { product: input.product },
    );
  }

  const settled = await Promise.allSettled(
    ctx.placeSources.map((s) => s.search({ center, radiusMeters: radius, storeTypes: [...weights.keys()] })),
  );
  const failures = settled.filter((r): r is PromiseRejectedResult => r.status === "rejected");
  for (const f of failures) ctx.logger?.warn("place source failed", { reason: String(f.reason) });
  if (failures.length === settled.length) {
    throw new VeyloError("UPSTREAM_UNAVAILABLE", "No place source could be reached. Try again shortly.", {
      sources: ctx.placeSources.map((s) => s.name),
    });
  }

  const searchLocation = normalize(input.location);
  const seen = new Set<string>();
  const scored: Array<{ place: Place; fit: number; rank: number }> = [];
  for (const place of settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []))) {
    const fit = weights.get(place.storeType) ?? 0;
    if (fit === 0) continue;
    const distance = Math.round(haversineMeters(center, { lat: place.lat, lon: place.lon }));
    if (distance > radius * 1.05) continue;
    const key = `${normalize(place.name)}|${place.lat.toFixed(4)}|${place.lon.toFixed(4)}`;
    if (seen.has(place.id) || seen.has(key)) continue;
    seen.add(place.id);
    seen.add(key);
    const proximity = 1 - Math.min(distance / radius, 1);
    scored.push({
      place: { ...place, name: place.name.trim() || `Unnamed ${STORE_TYPE_LABEL[place.storeType]}`, distanceMeters: distance, searchLocation },
      fit,
      rank: fit * FIT_WEIGHT + proximity * PROXIMITY_WEIGHT,
    });
  }
  scored.sort((a, b) => b.rank - a.rank || (a.place.distanceMeters ?? 0) - (b.place.distanceMeters ?? 0));
  const top = scored.slice(0, ctx.options?.maxPlaces ?? DEFAULT_MAX_PLACES);

  await ctx.placeStore.putMany(top.map((t) => t.place));
  const categoryName = product?.category ?? input.category ?? input.product;
  return {
    places: top.map(({ place, fit }) => {
      const label = STORE_TYPE_LABEL[place.storeType];
      return {
        id: place.id,
        name: place.name,
        category: label,
        address: place.address,
        latitude: place.lat,
        longitude: place.lon,
        distanceMeters: place.distanceMeters,
        source: place.source,
        relevanceScore: round2(fit),
        // Appearing in a place listing never proves stock. Use check_local_inventory for evidence.
        inventoryStatus: "UNKNOWN" as const,
        evidenceSummary: `Listed in ${place.source} as "${label}"; this store type fits "${categoryName}" (fit ${round2(fit)}). Stock has not been checked.`,
      };
    }),
  };
}
