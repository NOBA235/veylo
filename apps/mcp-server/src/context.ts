import {
  CatalogService, consoleLogger, createCoreServices, createToolExecutor, InMemoryEvidenceLedger, InMemoryPlaceStore,
  BraveSearchProvider, VeyloError, type CoreContext, type Geocoder,
} from "@veylo/core";
import { createPgProductRepository, createPgShoppingListStore } from "@veylo/core/pg";
import { createAiAssists } from "@veylo/ai";
import { makeCtx } from "@veylo/core/testing";
import { createDb } from "@veylo/db";
import type { ServerConfig } from "./config";

/** Phase 7 supplies a real geocoder. Until then, only "lat,lon" locations resolve. */
const noGeocoder: Geocoder = {
  async geocode() {
    throw new VeyloError("NOT_CONFIGURED", 'No geocoder is configured yet. Pass the location as "lat,lon".');
  },
};

export function buildContext(config: ServerConfig) {
  const ai = createAiAssists({ logger: consoleLogger });

  if (config.demoMode) {
    const demoCtx = makeCtx({
      identifyAssist: ai.identifyAssist,
      compareAssist: ai.compareAssist,
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
    // Phase 7 adds the Overpass place source and web-evidence providers. Until then discover_local_places
    // reports NOT_CONFIGURED rather than returning made-up stores.
    placeSources: [],
    geocoder: noGeocoder,
    placeStore: new InMemoryPlaceStore(),
    ledger: new InMemoryEvidenceLedger(),
    evidenceProviders: [],
    shoppingLists: createPgShoppingListStore(db),
    webSearch: config.braveApiKey ? new BraveSearchProvider(config.braveApiKey) : undefined,
    logger: consoleLogger,
  };
  return { ctx, handlers: createToolExecutor(createCoreServices(ctx), ctx.logger), close: () => pool.end(), ai };
}
