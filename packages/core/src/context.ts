import type { InventoryStatus } from "@veylo/types";
import type { CompareAssist, IdentifyAssist } from "./assist";
import type { CatalogService } from "./catalog-service";
import type { GeoPoint } from "./geo";
import type { ShoppingListStore } from "./shopping";
import type { StoreType } from "./store-categories";
import type { WebSearchProvider } from "./web";

export interface Logger {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
}
export const noopLogger: Logger = { info() {}, warn() {} };
export const consoleLogger: Logger = {
  info: (m, f) => console.log(JSON.stringify({ level: "info", msg: m, ...f })),
  warn: (m, f) => console.warn(JSON.stringify({ level: "warn", msg: m, ...f })),
};

/** A real-world business as reported by a place source. Contact fields exist only when the source had them. */
export interface Place {
  id: string;
  name: string;
  storeType: StoreType;
  lat: number;
  lon: number;
  address?: string;
  phone?: string;
  website?: string;
  openingHours?: string; // raw, as listed by the source
  source: string; // e.g. "OpenStreetMap"
  sourceType: "osm" | "api";
  retrievedAt: string; // ISO-8601
  /** Set by discover_local_places, relative to that search's centre. */
  distanceMeters?: number;
  searchLocation?: string;
}

export interface PlaceQuery {
  center: GeoPoint;
  radiusMeters: number;
  storeTypes: StoreType[];
}
export interface PlaceSource {
  readonly name: string;
  search(query: PlaceQuery): Promise<Place[]>;
}
export interface Geocoder {
  geocode(text: string): Promise<GeoPoint | null>;
}
export interface PlaceStore {
  get(id: string): Promise<Place | undefined>;
  putMany(places: Place[]): Promise<void>;
}

/** A piece of product-specific evidence about a store, from a provider (web listing, store feed, user report). */
export interface InventorySignal {
  kind: "in_stock_confirmed" | "product_listed" | "product_mentioned";
  source: string;
  sourceType: "web" | "api" | "store" | "user";
  timestamp: string; // ISO-8601, when the evidence was observed
  confidence: number;
  summary: string;
  /** True when the signal comes from the store's own site or feed. */
  firstParty?: boolean;
  url?: string;
}
export interface InventoryEvidenceProvider {
  readonly name: string;
  lookup(req: { place: Place; product: string }): Promise<InventorySignal[]>;
}

export interface LedgerEntry {
  placeId: string;
  store: string;
  product: string; // canonical product name when resolvable
  status: InventoryStatus;
  confidence: number;
  distanceMeters?: number;
  searchLocation?: string;
  at: string; // ISO-8601
}
/** Session-level record of what was found, read by compare_products. */
export interface EvidenceLedger {
  record(entry: LedgerEntry): Promise<void>;
  bestFor(product: string, opts?: { searchLocation?: string; since?: string }): Promise<LedgerEntry | undefined>;
}

export interface CoreContext {
  catalog: CatalogService;
  placeSources: PlaceSource[];
  geocoder: Geocoder;
  placeStore: PlaceStore;
  ledger: EvidenceLedger;
  evidenceProviders: InventoryEvidenceProvider[];
  shoppingLists: ShoppingListStore;
  /** Optional. Without it the search_web tool reports NOT_CONFIGURED. */
  webSearch?: WebSearchProvider;
  /** When set, identify_product asks this provider after the rules stages. Absent means rules only. */
  identifyAssist?: IdentifyAssist;
  compareAssist?: CompareAssist;
  logger?: Logger;
  clock?: () => Date;
  options?: { maxPlaces?: number; defaultRadiusMeters?: number; confirmedMaxAgeMs?: number };
}
