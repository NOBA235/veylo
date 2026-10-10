import type { Place, PlaceStore } from "@veylo/core";

export interface CachedPlaceStoreOptions {
  initialPlaces?: Place[];
  ttlMs?: number;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export class CachedPlaceStore implements PlaceStore {
  private readonly places = new Map<string, { place: Place; storedAt: number }>();
  private readonly ttlMs: number;

  constructor(options: CachedPlaceStoreOptions = {}) {
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    if (options.initialPlaces) {
      const now = Date.now();
      for (const p of options.initialPlaces) {
        this.places.set(p.id, { place: p, storedAt: now });
      }
    }
  }

  async get(id: string): Promise<Place | undefined> {
    const entry = this.places.get(id);
    if (!entry) return undefined;
    if (Date.now() - entry.storedAt > this.ttlMs) {
      this.places.delete(id);
      return undefined;
    }
    return entry.place;
  }

  async putMany(places: Place[]): Promise<void> {
    const now = Date.now();
    for (const p of places) {
      this.places.set(p.id, { place: p, storedAt: now });
    }
  }

  async getAll(): Promise<Place[]> {
    const now = Date.now();
    const result: Place[] = [];
    for (const [id, entry] of this.places.entries()) {
      if (now - entry.storedAt > this.ttlMs) {
        this.places.delete(id);
      } else {
        result.push(entry.place);
      }
    }
    return result;
  }

  get size(): number {
    return this.places.size;
  }
}

