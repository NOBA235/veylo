// Test helpers: load the real seed JSON into the catalogue model, plus test doubles for ports.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { AliasType, CatalogProduct, CatalogRelationship, RelationshipType } from "../src/catalog";
import { InMemoryUserContextStore } from "../src/user-context";

// Exposed as "@veylo/core/testing" so other packages' tests can build a context from the real seed.
const readSeed = <T>(f: string): T =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../../db/seed/${f}`, import.meta.url)), "utf8")) as T;

export function deterministicUuid(name: string): string {
  const h = createHash("sha1").update(`veylo:${name}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

interface SeedCategory { name: string; parent: string | null }
interface SeedProduct {
  name: string; category: string; description: string; brand?: string | null;
  aliases: Partial<Record<AliasType, string[]>>;
  useCases: string[]; compatibility: string[]; attributes: Record<string, unknown>;
}

export function loadSeedCatalog(): CatalogProduct[] {
  const cats = readSeed<SeedCategory[]>("categories.json");
  const parentOf = new Map(cats.map((c) => [c.name, c.parent]));
  const rels = readSeed<Array<[string, RelationshipType, string]>>("relationships.json");
  const relFor = (name: string): CatalogRelationship[] => [
    ...rels.filter((r) => r[0] === name).map((r): CatalogRelationship => ({ type: r[1], direction: "from", other: r[2] })),
    ...rels.filter((r) => r[2] === name).map((r): CatalogRelationship => ({ type: r[1], direction: "to", other: r[0] })),
  ];
  return readSeed<SeedProduct[]>("products.json").map((p) => ({
    id: deterministicUuid(p.name),
    name: p.name,
    category: p.category,
    parentCategory: parentOf.get(p.category) ?? null,
    description: p.description,
    brand: p.brand ?? null,
    aliases: (Object.entries(p.aliases) as Array<[AliasType, string[]]>).flatMap(([type, list]) =>
      list.map((text) => ({ text, type })),
    ),
    useCases: p.useCases,
    compatibility: p.compatibility,
    attributes: p.attributes,
    relationships: relFor(p.name),
    evidence: [
      {
        source: "veylo-seed-v1",
        sourceType: "curated",
        observedAt: "2026-10-06T00:00:00.000Z",
        confidence: 0.8,
        summary: "Hand-curated catalogue entry (names, aliases, use cases). Says nothing about any store's stock.",
      },
    ],
  }));
}

// ---- Test doubles (unit-test fixtures only; the product never ships these as data) ----
import { CatalogService } from "../src/catalog-service";
import type { CoreContext, Geocoder, Place, PlaceQuery, PlaceSource } from "../src/context";
import { InMemoryEvidenceLedger, InMemoryPlaceStore, InMemoryProductRepository, InMemoryShoppingListStore } from "../src/memory";
import type { StoreType } from "../src/store-categories";

export const AUSTIN = { lat: 30.2672, lon: -97.7431 };
export const AUSTIN_TEXT = "30.2672,-97.7431";
const NOW = "2026-10-06T12:00:00.000Z";

/** Fixture place. dLat is degrees north of AUSTIN (0.001 deg ~ 111 m). All names are invented. */
export function fixturePlace(
  id: string,
  name: string,
  storeType: StoreType,
  dLat: number,
  extra: Partial<Place> = {},
): Place {
  return {
    id,
    name,
    storeType,
    lat: AUSTIN.lat + dLat,
    lon: AUSTIN.lon,
    source: "OpenStreetMap",
    sourceType: "osm",
    retrievedAt: NOW,
    ...extra,
  };
}

export const FIXTURE_PLACES: Place[] = [
  fixturePlace("osm:node/1", "Best Buy - South Lamar", "electronics", 0.005, {
    phone: "+1 512 443 6000",
    website: "https://www.bestbuy.com",
    address: "1004 S Lamar Blvd, Austin, TX 78704",
    openingHours: "Mo-Sa 10:00-20:00, Su 11:00-19:00",
  }),
  fixturePlace("osm:way/1", "Best Buy - South Lamar", "electronics", 0.005, {
    address: "1004 S Lamar Blvd, Austin, TX 78704",
  }), // duplicate representation
  fixturePlace("osm:node/2", "Altex Computers & Electronics", "computer", 0.02, {
    phone: "+1 512 832 9131",
    website: "https://www.altex.com",
    address: "8940 Research Blvd, Austin, TX 78758",
    openingHours: "Mo-Fr 08:30-18:30, Sa 09:00-17:00",
  }),
  fixturePlace("osm:node/3", "Apple Store - Barton Creek", "mobile_phone", 0.01, {
    phone: "+1 512 347 7888",
    website: "https://www.apple.com",
    address: "2901 S Capital of Texas Hwy, Austin, TX 78746",
    openingHours: "Mo-Sa 10:00-21:00, Su 11:00-18:00",
  }),
  fixturePlace("osm:node/4", "The Home Depot", "hardware", 0.004, {
    phone: "+1 512 416 1120",
    website: "https://www.homedepot.com",
    address: "3600 S IH 35 Frontage Rd, Austin, TX 78704",
    openingHours: "Mo-Sa 06:00-22:00, Su 08:00-20:00",
  }),
  fixturePlace("osm:node/5", "Ferguson Plumbing Supply", "plumbing_supplies", 0.006, {
    phone: "+1 512 447 5571",
    website: "https://www.ferguson.com",
    address: "8201 Cross Park Dr, Austin, TX 78754",
    openingHours: "Mo-Fr 07:00-17:00",
  }),
  fixturePlace("osm:node/6", "Breed & Co. Ace Hardware", "doityourself", 0.008, {
    phone: "+1 512 474 6621",
    website: "https://www.acehardware.com",
    address: "718 W 29th St, Austin, TX 78705",
    openingHours: "Mo-Sa 08:00-18:00, Su 10:00-17:00",
  }),
  fixturePlace("osm:node/7", "Target - South Congress", "supermarket", 0.003, {
    phone: "+1 512 441 7771",
    website: "https://www.target.com",
    address: "2300 W Ben White Blvd, Austin, TX 78704",
    openingHours: "Mo-Su 08:00-22:00",
  }),
  fixturePlace("osm:node/8", "Micro Center (Dallas Regional)", "electronics", 0.2, {
    phone: "+1 972 664 8500",
    website: "https://www.microcenter.com",
    address: "13929 N Central Expy, Dallas, TX 75243",
  }),
  fixturePlace("osm:node/9", "Harbor Freight Tools", "hardware", 0.006, {
    phone: "+1 512 892 4848",
    website: "https://www.harborfreight.com",
    address: "6800 West Gate Blvd, Austin, TX 78745",
  }),
];

export class FakePlaceSource implements PlaceSource {
  readonly name = "FakePlaceSource (test double)";
  constructor(private readonly places: Place[], private readonly fail = false) {}
  async search(q: PlaceQuery): Promise<Place[]> {
    if (this.fail) throw new Error("fake upstream down");
    return this.places.filter((p) => q.storeTypes.includes(p.storeType));
  }
}

export class FakeGeocoder implements Geocoder {
  constructor(private readonly table: Record<string, { lat: number; lon: number }> = { austin: AUSTIN }) {}
  async geocode(text: string) {
    return this.table[text.trim().toLowerCase().split(",")[0] ?? ""] ?? null;
  }
}

export interface CtxOverrides extends Partial<CoreContext> {
  places?: Place[];
}

export function makeCtx(over: CtxOverrides = {}): CoreContext & { warnings: string[] } {
  const warnings: string[] = [];
  const { places, ...rest } = over;
  return {
    catalog: new CatalogService(new InMemoryProductRepository(loadSeedCatalog())),
    placeSources: [new FakePlaceSource(places ?? FIXTURE_PLACES)],
    geocoder: new FakeGeocoder(),
    placeStore: new InMemoryPlaceStore(),
    ledger: new InMemoryEvidenceLedger(),
    evidenceProviders: [],
    shoppingLists: new InMemoryShoppingListStore(),
    userContext: new InMemoryUserContextStore(),
    logger: { info() {}, warn: (m: string) => void warnings.push(m) },
    clock: () => new Date(NOW),
    warnings,
    ...rest,
  };
}
