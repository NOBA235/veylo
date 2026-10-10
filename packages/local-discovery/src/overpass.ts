import {
  classifyOsmTags,
  OSM_SELECTORS,
  type GeoPoint,
  type Logger,
  type Place,
  type PlaceQuery,
  type PlaceSource,
  type StoreType,
} from "@veylo/core";

export interface OverpassOptions {
  endpoint?: string;
  endpoints?: string[];
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
  logger?: Logger;
  cacheTtlMs?: number;
}

const DEFAULT_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export function formatOsmAddress(tags: Record<string, string>): string | undefined {
  const parts: string[] = [];
  const line1 = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
  if (line1) parts.push(line1);
  const city = tags["addr:city"] ?? tags["addr:town"] ?? tags["addr:suburb"];
  const postcode = tags["addr:postcode"];
  if (city && postcode) parts.push(`${city}, ${postcode}`);
  else if (city) parts.push(city);
  else if (postcode) parts.push(postcode);
  return parts.length > 0 ? parts.join(", ") : undefined;
}

export function buildOverpassQuery(
  center: GeoPoint,
  radiusMeters: number,
  storeTypes: StoreType[],
  timeoutSec: number = 25,
): string {
  const clauses: string[] = [];
  const radius = Math.round(radiusMeters);
  const lat = center.lat.toFixed(6);
  const lon = center.lon.toFixed(6);

  for (const st of storeTypes) {
    const selectors = OSM_SELECTORS[st] ?? [];
    for (const sel of selectors) {
      const tagFilters = Object.entries(sel)
        .map(([k, v]) => `["${k}"="${v}"]`)
        .join("");
      clauses.push(`  node${tagFilters}(around:${radius},${lat},${lon});`);
      clauses.push(`  way${tagFilters}(around:${radius},${lat},${lon});`);
    }
  }

  return `[out:json][timeout:${timeoutSec}];\n(\n${clauses.join("\n")}\n);\nout center tags;`;
}

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

export class OverpassPlaceSource implements PlaceSource {
  readonly name = "OpenStreetMap / Overpass";
  private readonly endpoints: string[];
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof globalThis.fetch;
  private readonly logger?: Logger;
  private readonly cacheTtlMs: number;
  private readonly cache = new Map<string, { places: Place[]; expiresAt: number }>();

  constructor(options: OverpassOptions = {}) {
    this.endpoints = options.endpoints ?? (options.endpoint ? [options.endpoint] : DEFAULT_ENDPOINTS);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchFn = options.fetch ?? globalThis.fetch;
    this.logger = options.logger;
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  }

  async search(query: PlaceQuery): Promise<Place[]> {
    if (query.storeTypes.length === 0) return [];

    const cacheKey = `${query.center.lat.toFixed(4)},${query.center.lon.toFixed(4)}|${Math.round(query.radiusMeters)}|${query.storeTypes.slice().sort().join(",")}`;
    const cached = this.cache.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return cached.places;
    }

    const ql = buildOverpassQuery(query.center, query.radiusMeters, query.storeTypes);
    const retrievedAt = new Date().toISOString();

    let lastError: Error | null = null;
    for (const endpoint of this.endpoints) {
      try {
        const places = await this.queryEndpoint(endpoint, ql, retrievedAt, query.storeTypes);
        this.cache.set(cacheKey, { places, expiresAt: now + this.cacheTtlMs });
        return places;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        this.logger?.warn(`Overpass endpoint failed (${endpoint}): ${lastError.message}`);
      }
    }

    throw lastError ?? new Error("All Overpass endpoints failed");
  }

  private async queryEndpoint(
    endpoint: string,
    ql: string,
    retrievedAt: string,
    requestedTypes: StoreType[],
  ): Promise<Place[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await this.fetchFn(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Accept: "application/json",
          "User-Agent": "Veylo-Alexa-Hackathon/1.0 (https://github.com/NOBA235/veylo)",
        },
        body: `data=${encodeURIComponent(ql)}`,
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      const data = (await res.json()) as OverpassResponse;
      const elements = data.elements ?? [];
      const places: Place[] = [];

      for (const el of elements) {
        const lat = el.lat ?? el.center?.lat;
        const lon = el.lon ?? el.center?.lon;
        if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) {
          continue;
        }

        const tags = el.tags ?? {};
        const storeType = classifyOsmTags(tags) ?? requestedTypes[0];
        if (!storeType) continue;

        const name = (tags.name ?? tags.brand ?? tags.operator ?? "").trim();
        const address = formatOsmAddress(tags);
        const phone = tags.phone ?? tags["contact:phone"];
        const website = tags.website ?? tags["contact:website"];
        const openingHours = tags.opening_hours;

        places.push({
          id: `osm:${el.type}/${el.id}`,
          name,
          storeType,
          lat,
          lon,
          address,
          phone,
          website,
          openingHours,
          source: "OpenStreetMap",
          sourceType: "osm",
          retrievedAt,
        });
      }

      return places;
    } finally {
      clearTimeout(timeout);
    }
  }
}

