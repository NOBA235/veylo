import { parseLatLon, type Geocoder, type GeoPoint, type Logger } from "@veylo/core";

export interface NominatimOptions {
  endpoint?: string;
  userAgent?: string;
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
  logger?: Logger;
}

const DEFAULT_NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const DEFAULT_USER_AGENT = "Veylo-Alexa-Hackathon/1.0 (https://github.com/NOBA235/veylo)";
const DEFAULT_TIMEOUT_MS = 6000;

interface NominatimResult {
  lat: string;
  lon: string;
  display_name?: string;
}

export class NominatimGeocoder implements Geocoder {
  private readonly endpoint: string;
  private readonly userAgent: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof globalThis.fetch;
  private readonly logger?: Logger;
  private readonly cache = new Map<string, GeoPoint | null>();

  constructor(options: NominatimOptions = {}) {
    this.endpoint = options.endpoint ?? process.env.NOMINATIM_URL ?? DEFAULT_NOMINATIM_ENDPOINT;
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchFn = options.fetch ?? globalThis.fetch;
    this.logger = options.logger;
  }

  async geocode(text: string): Promise<GeoPoint | null> {
    const trimmed = text.trim();
    if (!trimmed) return null;

    // Check if it's already "lat,lon" coordinates
    const directCoords = parseLatLon(trimmed);
    if (directCoords) return directCoords;

    const normalizedKey = trimmed.toLowerCase();
    if (this.cache.has(normalizedKey)) {
      return this.cache.get(normalizedKey) ?? null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const url = `${this.endpoint}?format=json&limit=1&q=${encodeURIComponent(trimmed)}`;
      const res = await this.fetchFn(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": this.userAgent,
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        this.logger?.warn(`Nominatim geocoding failed with HTTP ${res.status}`);
        return null;
      }

      const results = (await res.json()) as NominatimResult[];
      if (!Array.isArray(results) || results.length === 0) {
        this.cache.set(normalizedKey, null);
        return null;
      }

      const first = results[0];
      const lat = parseFloat(first.lat);
      const lon = parseFloat(first.lon);

      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        const point: GeoPoint = { lat, lon };
        this.cache.set(normalizedKey, point);
        return point;
      }

      this.cache.set(normalizedKey, null);
      return null;
    } catch (err) {
      this.logger?.warn(`Nominatim geocoding error for "${trimmed}": ${String(err)}`);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}

