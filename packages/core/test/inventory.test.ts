import assert from "node:assert/strict";
import { test } from "node:test";
import { toolContracts } from "@veylo/types";
import type { InventoryEvidenceProvider, InventorySignal } from "../src/context";
import { VeyloError } from "../src/errors";
import { assessInventory, checkLocalInventory } from "../src/inventory";
import { fixturePlace, makeCtx } from "./helpers";

const NOW = new Date("2026-10-06T12:00:00.000Z");
const ago = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();
const place = fixturePlace("osm:node/1", "Fixture Electronics", "electronics", 0.005, { phone: "+1 512 555 0100" });
const sig = (over: Partial<InventorySignal> = {}): InventorySignal => ({
  kind: "product_listed", source: "store website", sourceType: "web", timestamp: ago(1),
  confidence: 0.7, summary: "Product page found.", firstParty: true, ...over,
});
const assess = (signals: InventorySignal[], relevance: number | undefined = 1) =>
  assessInventory({ place, product: "USB-C to HDMI adapter", relevance, productCategory: "video adapters", signals, now: NOW });
const assessUncatalogued = (signals: InventorySignal[]) =>
  assessInventory({ place, product: "mystery item", signals, now: NOW }); // no relevance: product not in the catalogue
const parse = (o: unknown) => toolContracts.check_local_inventory.output.parse(o);

test("store type alone is UNKNOWN, with category evidence that says it is not stock evidence", () => {
  const out = parse(assess([]));
  assert.equal(out.status, "UNKNOWN");
  assert.ok(out.confidence <= 0.3);
  assert.equal(out.evidence.length, 1);
  assert.match(out.evidence[0]!.evidenceSummary, /does not show the product is in stock/);
  assert.match(out.nextAction, /Call Fixture Electronics on \+1 512 555 0100/);
});

test("a product that is not in the catalogue is UNKNOWN with no evidence", () => {
  const out = parse(assessUncatalogued([]));
  assert.equal(out.status, "UNKNOWN");
  assert.deepEqual(out.evidence, []);
});

test("next action does not invent a phone number", () => {
  const out = assessInventory({ place: fixturePlace("x", "No Contact Shop", "electronics", 0), product: "p", relevance: 1, signals: [], now: NOW });
  assert.match(out.nextAction, /none are listed/);
  assert.ok(!/\d{3}/.test(out.nextAction));
});

test("fresh in-stock signal from a store is CONFIRMED and carries its evidence", () => {
  const out = parse(assess([sig({ kind: "in_stock_confirmed", sourceType: "store", timestamp: ago(2), confidence: 0.95, summary: "Store feed: 3 in stock." })]));
  assert.equal(out.status, "CONFIRMED");
  assert.equal(out.confidence, 0.95);
  assert.ok(out.evidence.some((e) => e.sourceType === "store"));
});

test("a web page claiming 'in stock' can never confirm", () => {
  const out = parse(assess([sig({ kind: "in_stock_confirmed", sourceType: "web", firstParty: false })]));
  assert.equal(out.status, "WEB_FOUND");
});

test("stale or future-dated stock claims degrade to a listing", () => {
  assert.equal(assess([sig({ kind: "in_stock_confirmed", sourceType: "store", timestamp: ago(48) })]).status, "LIKELY");
  assert.equal(assess([sig({ kind: "in_stock_confirmed", sourceType: "store", timestamp: ago(-2) })]).status, "LIKELY");
});

test("first-party listing plus strong store fit is LIKELY, below the CONFIRMED range", () => {
  const out = parse(assess([sig()], 0.9));
  assert.equal(out.status, "LIKELY");
  assert.ok(out.confidence >= 0.55 && out.confidence <= 0.8);
  assert.match(out.nextAction, /confirm current stock/);
});

test("first-party listing at a poor-fit store only reaches WEB_FOUND", () => {
  assert.equal(assess([sig()], 0.3).status, "WEB_FOUND");
});

test("third-party web mention is WEB_FOUND", () => {
  const out = parse(assess([sig({ firstParty: false, source: "blog" })]));
  assert.equal(out.status, "WEB_FOUND");
  assert.match(out.nextAction, /does not show it is on the shelf/);
});

test("schema rejects trust states that lack their evidence", () => {
  const bad = { store: "s", product: "p", confidence: 0.9, nextAction: "x" };
  const out = toolContracts.check_local_inventory.output;
  assert.equal(out.safeParse({ ...bad, status: "CONFIRMED", evidence: [] }).success, false);
  assert.equal(out.safeParse({ ...bad, status: "LIKELY", evidence: [] }).success, false);
  assert.equal(out.safeParse({ ...bad, status: "WEB_FOUND", evidence: [{ source: "osm", sourceType: "osm", timestamp: NOW.toISOString(), confidence: 0.5, evidenceSummary: "x" }] }).success, false);
  assert.equal(out.safeParse({ ...bad, status: "UNKNOWN", evidence: [] }).success, true);
});

test("sweep: across all signal combinations CONFIRMED only ever appears with fresh store/api/user stock evidence", () => {
  const kinds: InventorySignal["kind"][] = ["in_stock_confirmed", "product_listed", "product_mentioned"];
  const sources: InventorySignal["sourceType"][] = ["web", "api", "store", "user"];
  const ages = [-3, 0.5, 23, 25, 100];
  let confirmed = 0;
  for (const kind of kinds) for (const sourceType of sources) for (const h of ages) for (const firstParty of [true, false]) for (const relevance of [undefined, 0, 0.3, 0.6, 1]) {
    const out = parse(assess([sig({ kind, sourceType, firstParty, timestamp: ago(h) })], relevance));
    if (out.status !== "CONFIRMED") continue;
    confirmed++;
    assert.equal(kind, "in_stock_confirmed");
    assert.ok(["api", "store", "user"].includes(sourceType));
    assert.ok(h >= -0.05 && h <= 24, `age ${h}h`);
    assert.ok(out.evidence.length > 0);
  }
  assert.ok(confirmed > 0, "sweep should reach CONFIRMED for legitimate combinations");
});

// ---- service ----
const provider = (signals: InventorySignal[], fail = false): InventoryEvidenceProvider => ({
  name: "test provider",
  lookup: async () => { if (fail) throw new Error("boom"); return signals; },
});

test("service: unknown store id is NOT_FOUND", async () => {
  await assert.rejects(checkLocalInventory(makeCtx(), { storeId: "nope", product: "PTFE tape" }), (e) => e instanceof VeyloError && e.code === "NOT_FOUND");
});

test("service: resolves aliases, uses provider evidence and records the result", async () => {
  const ctx = makeCtx({ evidenceProviders: [provider([sig({ timestamp: new Date("2026-10-06T11:00:00Z").toISOString() })])] });
  await ctx.placeStore.putMany([place]);
  const out = parse(await checkLocalInventory(ctx, { storeId: place.id, product: "laptop to TV adapter" }));
  assert.equal(out.product, "USB-C to HDMI adapter");
  assert.equal(out.status, "LIKELY");
  assert.equal((await ctx.ledger.bestFor("USB-C to HDMI adapter"))?.status, "LIKELY");
});

test("service: a failing provider is logged and does not break the check", async () => {
  const ctx = makeCtx({ evidenceProviders: [provider([], true)] });
  await ctx.placeStore.putMany([place]);
  const out = parse(await checkLocalInventory(ctx, { storeId: place.id, product: "USB-C to HDMI adapter" }));
  assert.equal(out.status, "UNKNOWN");
  assert.equal(ctx.warnings.length, 1);
});
