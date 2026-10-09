import assert from "node:assert/strict";
import { test } from "node:test";
import { TOOL_NAMES, toolContracts } from "@veylo/types";
import { contextClarification } from "../src/clarify";
import type { InventoryEvidenceProvider } from "../src/context";
import { createCoreServices } from "../src/services";
import { AUSTIN_TEXT, makeCtx } from "./helpers";

// Test double: a web listing on the first fixture store's own site for one product only.
const listingProvider: InventoryEvidenceProvider = {
  name: "test web listing",
  lookup: async ({ place, product }) =>
    place.id === "osm:node/1" && product === "USB-C to HDMI adapter"
      ? [{ kind: "product_listed", source: "store website", sourceType: "web", timestamp: "2026-10-06T10:00:00.000Z",
           confidence: 0.72, firstParty: true, summary: "Online product listing found; shelf stock not shown." }]
      : [],
};

test("killer demo through the service layer: unknown -> identified -> local -> evidence -> compare -> act", async () => {
  const s = createCoreServices(makeCtx({ evidenceProviders: [listingProvider] }));
  const C = toolContracts;

  const id = C.identify_product.output.parse(
    await s.identify_product({ description: "I need that little thing that lets me connect my laptop to a TV. I don't know what it's called." }),
  );
  assert.equal(id.product, "USB-C to HDMI adapter");
  assert.ok(contextClarification({}), "agent should ask local-vs-online next");
  assert.equal(contextClarification({ urgency: "today", location: AUSTIN_TEXT }), undefined);

  const near = C.discover_local_places.output.parse(await s.discover_local_places({ product: id.product, category: id.category, location: AUSTIN_TEXT }));
  assert.equal(near.places[0]?.id, "osm:node/1");

  const first = C.check_local_inventory.output.parse(await s.check_local_inventory({ storeId: "osm:node/1", product: id.product }));
  const second = C.check_local_inventory.output.parse(await s.check_local_inventory({ storeId: "osm:node/9", product: id.product }));
  assert.equal(first.status, "LIKELY");
  assert.ok(first.evidence.some((e) => e.sourceType === "web") && first.evidence.some((e) => e.sourceType === "osm"));
  assert.equal(second.status, "UNKNOWN");

  const cmp = C.compare_products.output.parse(await s.compare_products({ products: [id.product, ...id.alternatives.slice(0, 2)], location: AUSTIN_TEXT }));
  assert.match(cmp.recommendation, /^USB-C to HDMI adapter/);
  assert.equal(cmp.comparison.find((c) => c.product === id.product)?.availability, "LIKELY");

  C.get_place_details.output.parse(await s.get_place_details({ placeId: "osm:node/1" }));
  C.get_directions.output.parse(await s.get_directions({ placeId: "osm:node/1", origin: "Austin, TX" }));
  assert.equal(C.contact_store.output.parse(await s.contact_store({ storeId: "osm:node/1" })).contactMethod, "phone");
});

test("second demo generalises: PTFE tape finds hardware-type stores and reports honest UNKNOWN", async () => {
  const s = createCoreServices(makeCtx({ evidenceProviders: [listingProvider] }));
  const id = await s.identify_product({ description: "I need the white tape plumbers use around pipe threads." });
  assert.equal(id.product, "PTFE tape");
  const near = await s.discover_local_places({ product: id.product, category: id.category, location: AUSTIN_TEXT });
  assert.deepEqual(near.places.map((p) => p.id), ["osm:node/4", "osm:node/6", "osm:node/5"]);
  const statuses = [];
  for (const p of near.places) statuses.push((await s.check_local_inventory({ storeId: p.id, product: id.product })).status);
  assert.deepEqual(statuses, ["UNKNOWN", "UNKNOWN", "UNKNOWN"]);
});

test("the service surface covers every tool in the contract registry", () => {
  const s = createCoreServices(makeCtx());
  assert.deepEqual(Object.keys(s).sort(), [...TOOL_NAMES].sort());
});

test("an unnamed place keeps one honest name across discovery, inventory, details and directions", async () => {
  const s = createCoreServices(makeCtx());
  await s.discover_local_places({ product: "USB-C to HDMI adapter", location: AUSTIN_TEXT });
  const name = "Unnamed electronics store";
  assert.equal((await s.check_local_inventory({ storeId: "osm:node/9", product: "USB-C to HDMI adapter" })).store, name);
  assert.equal((await s.get_place_details({ placeId: "osm:node/9" })).name, name);
  assert.ok((await s.get_directions({ placeId: "osm:node/9" })).destination.startsWith(name));
});
