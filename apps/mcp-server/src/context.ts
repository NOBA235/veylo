import {
  CatalogService, consoleLogger, createCoreServices, createToolExecutor, InMemoryEvidenceLedger,
  BraveSearchProvider, type CoreContext, type Geocoder, type GeoPoint,
} from "@veylo/core";
import { createPgProductRepository, createPgShoppingListStore } from "@veylo/core/pg";
import { createAiAssists } from "@veylo/ai";
import { makeCtx, FakeGeocoder, FakePlaceSource, FIXTURE_PLACES } from "@veylo/core/testing";
import { NominatimGeocoder, OverpassPlaceSource, WebEvidenceProvider, CachedPlaceStore } from "@veylo/local-discovery";
import { createDb } from "@veylo/db";
import type { ServerConfig } from "./config";

export function buildContext(config: ServerConfig) {
  const ai = createAiAssists({ logger: consoleLogger });
  const realGeocoder = new NominatimGeocoder({ logger: consoleLogger });
  const overpass = new OverpassPlaceSource({ logger: consoleLogger });
  const webSearch = config.braveApiKey ? new BraveSearchProvider(config.braveApiKey) : undefined;
  const webEvidence = new WebEvidenceProvider({ webSearch });

  if (config.demoMode) {
    const fakeGeocoder = new FakeGeocoder();
    const hybridGeocoder: Geocoder = {
      async geocode(text: string): Promise<GeoPoint | null> {
        const fake = await fakeGeocoder.geocode(text);
        if (fake) return fake;
        return realGeocoder.geocode(text);
      },
    };

    const demoCtx = makeCtx({
      identifyAssist: ai.identifyAssist,
      compareAssist: ai.compareAssist,
      geocoder: hybridGeocoder,
      placeSources: [new FakePlaceSource(FIXTURE_PLACES), overpass],
      placeStore: new CachedPlaceStore({ initialPlaces: FIXTURE_PLACES }),
      evidenceProviders: [
        {
          name: "demo web listing",
          lookup: async ({ place, product }) =>
            place.id === "osm:node/1" && product === "USB-C to HDMI adapter"
              ? [
                  {
                    kind: "product_listed",
                    source: "store website",
                    sourceType: "web",
                    timestamp: new Date().toISOString(),
                    confidence: 0.72,
                    firstParty: true,
                    summary: "Online product listing found; shelf stock not shown.",
                  },
                ]
              : [],
        },
        webEvidence,
      ],
      clock: () => new Date(),
    });
    return {
      ctx: demoCtx,
      handlers: createToolExecutor(createCoreServices(demoCtx), demoCtx.logger),
      close: async () => {},
      ai,
    };
  }

  const { db, pool } = createDb();
  const ctx: CoreContext = {
    catalog: new CatalogService(createPgProductRepository(db)),
    identifyAssist: ai.identifyAssist,
    compareAssist: ai.compareAssist,
    placeSources: [overpass],
    geocoder: realGeocoder,
    placeStore: new CachedPlaceStore(),
    ledger: new InMemoryEvidenceLedger(),
    evidenceProviders: [webEvidence],
    shoppingLists: createPgShoppingListStore(db),
    webSearch,
    logger: consoleLogger,
  };
  return { ctx, handlers: createToolExecutor(createCoreServices(ctx), ctx.logger), close: () => pool.end(), ai };
}
