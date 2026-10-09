import {
  CatalogService, consoleLogger, createCoreServices, createToolExecutor, InMemoryEvidenceLedger, InMemoryPlaceStore,
  BraveSearchProvider, VeyloError, type CoreContext, type Geocoder,
} from "@veylo/core";
import { createPgProductRepository, createPgShoppingListStore } from "@veylo/core/pg";
import { createDb } from "@veylo/db";
import type { ServerConfig } from "./config";

/** Phase 7 supplies a real geocoder. Until then, only "lat,lon" locations resolve. */
const noGeocoder: Geocoder = {
  async geocode() {
    throw new VeyloError("NOT_CONFIGURED", 'No geocoder is configured yet. Pass the location as "lat,lon".');
  },
};

export function buildContext(config: ServerConfig) {
  const { db, pool } = createDb();
  const ctx: CoreContext = {
    catalog: new CatalogService(createPgProductRepository(db)),
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
  return { ctx, handlers: createToolExecutor(createCoreServices(ctx), ctx.logger), close: () => pool.end() };
}
