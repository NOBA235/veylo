import type { CatalogProduct, ProductRepository } from "./catalog";
import type { EvidenceLedger, LedgerEntry, Place, PlaceStore } from "./context";

/** Holds a fixed catalogue in memory. Used by tests; production uses the Postgres repository. */
export class InMemoryProductRepository implements ProductRepository {
  constructor(private readonly products: CatalogProduct[]) {}
  async loadCatalog(): Promise<CatalogProduct[]> {
    return this.products;
  }
}

/** Process-local place store. Phase 7 replaces it with a Postgres cache with timestamps. */
export class InMemoryPlaceStore implements PlaceStore {
  private readonly places = new Map<string, Place>();
  async get(id: string): Promise<Place | undefined> {
    return this.places.get(id);
  }
  async putMany(places: Place[]): Promise<void> {
    for (const p of places) this.places.set(p.id, p);
  }
}

const STATUS_RANK = { CONFIRMED: 3, LIKELY: 2, WEB_FOUND: 1, UNKNOWN: 0 } as const;

export class InMemoryEvidenceLedger implements EvidenceLedger {
  private readonly entries: LedgerEntry[] = [];
  async record(entry: LedgerEntry): Promise<void> {
    this.entries.push(entry);
  }
  async bestFor(product: string, opts?: { searchLocation?: string; since?: string }): Promise<LedgerEntry | undefined> {
    const key = product.toLowerCase();
    return this.entries
      .filter(
        (e) =>
          e.product.toLowerCase() === key &&
          (!opts?.searchLocation || e.searchLocation === opts.searchLocation) &&
          (!opts?.since || e.at >= opts.since),
      )
      .sort(
        (a, b) =>
          STATUS_RANK[b.status] - STATUS_RANK[a.status] ||
          b.confidence - a.confidence ||
          (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity),
      )[0];
  }
}

import { randomUUID } from "node:crypto";
import type { ShoppingListItem, ShoppingListStore } from "./shopping";

/** Process-local shopping lists, for tests. Production uses the Postgres store. */
export class InMemoryShoppingListStore implements ShoppingListStore {
  readonly lists = new Map<string, ShoppingListItem[]>();
  async create(items: ShoppingListItem[]): Promise<{ id: string }> {
    const id = randomUUID();
    this.lists.set(id, items);
    return { id };
  }
}
