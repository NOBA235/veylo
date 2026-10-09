import assert from "node:assert/strict";
import { test } from "node:test";
import { toolContracts } from "@veylo/types";
import { VeyloError } from "../src/errors";
import { discoverLocalPlaces } from "../src/places";
import { classifyOsmTags, parseStoreHints, storeWeightsForCategory } from "../src/store-categories";
import { AUSTIN_TEXT, FakePlaceSource, FIXTURE_PLACES, makeCtx } from "./helpers";

const ids = (o: { places: Array<{ id: string }> }) => o.places.map((p) => p.id);
const code = (c: string) => (e: unknown) => e instanceof VeyloError && e.code === c;

test("adapter: only electronics-family stores, ordered by fit then proximity, duplicates and far stores removed", async () => {
  const out = toolContracts.discover_local_places.output.parse(
    await discoverLocalPlaces(makeCtx(), { product: "USB-C to HDMI adapter", location: AUSTIN_TEXT }),
  );
  assert.deepEqual(ids(out), ["osm:node/1", "osm:node/9", "osm:node/2", "osm:node/3"]);
});

test("every discovered place is UNKNOWN: appearing in a listing never implies stock", async () => {
  const out = await discoverLocalPlaces(makeCtx(), { product: "USB-C to HDMI adapter", location: AUSTIN_TEXT });
  assert.ok(out.places.every((p) => p.inventoryStatus === "UNKNOWN"));
  assert.ok(out.places.every((p) => /Stock has not been checked/.test(p.evidenceSummary)));
});

test("unnamed places are labelled honestly and distances are whole metres", async () => {
  const out = await discoverLocalPlaces(makeCtx(), { product: "USB-C to HDMI adapter", location: AUSTIN_TEXT });
  assert.equal(out.places.find((p) => p.id === "osm:node/9")?.name, "Unnamed electronics store");
  assert.ok(out.places.every((p) => Number.isInteger(p.distanceMeters)));
});

test("generalises: PTFE tape maps to hardware, DIY and plumbing supply, not electronics", async () => {
  const out = await discoverLocalPlaces(makeCtx(), { product: "PTFE tape", location: AUSTIN_TEXT });
  assert.deepEqual(ids(out), ["osm:node/4", "osm:node/6", "osm:node/5"]);
});

test("caller-supplied storeCategories override the catalogue mapping", async () => {
  const out = await discoverLocalPlaces(makeCtx(), { product: "anything", location: AUSTIN_TEXT, storeCategories: ["hardware"] });
  assert.deepEqual(ids(out), ["osm:node/4"]);
});

test("radius is honoured", async () => {
  const out = await discoverLocalPlaces(makeCtx(), { product: "USB-C to HDMI adapter", location: AUSTIN_TEXT, radiusMeters: 1000 });
  assert.deepEqual(ids(out), ["osm:node/1", "osm:node/9"]);
});

test("a place name is resolved through the geocoder; unknown names fail clearly", async () => {
  const ctx = makeCtx();
  assert.ok((await discoverLocalPlaces(ctx, { product: "PTFE tape", location: "Austin, TX" })).places.length > 0);
  await assert.rejects(discoverLocalPlaces(ctx, { product: "PTFE tape", location: "Nowhere" }), code("GEOCODE_FAILED"));
});

test("unknown product without a category is refused rather than guessed", async () => {
  await assert.rejects(discoverLocalPlaces(makeCtx(), { product: "flibbertigibbet widget", location: AUSTIN_TEXT }), code("UNKNOWN_CATEGORY"));
});

test("results are stored so later tools can resolve ids, with distance and search location", async () => {
  const ctx = makeCtx();
  await discoverLocalPlaces(ctx, { product: "USB-C to HDMI adapter", location: AUSTIN_TEXT });
  const stored = await ctx.placeStore.get("osm:node/1");
  assert.ok(stored && stored.distanceMeters! > 0 && stored.searchLocation);
  assert.equal(await ctx.placeStore.get("osm:node/8"), undefined);
});

test("one failing source is tolerated; all failing is an upstream error", async () => {
  const ok = new FakePlaceSource(FIXTURE_PLACES);
  const bad = new FakePlaceSource([], true);
  const partial = makeCtx({ placeSources: [bad, ok] });
  assert.ok((await discoverLocalPlaces(partial, { product: "PTFE tape", location: AUSTIN_TEXT })).places.length > 0);
  assert.equal(partial.warnings.length, 1);
  await assert.rejects(
    discoverLocalPlaces(makeCtx({ placeSources: [bad] }), { product: "PTFE tape", location: AUSTIN_TEXT }),
    code("UPSTREAM_UNAVAILABLE"),
  );
  await assert.rejects(
    discoverLocalPlaces(makeCtx({ placeSources: [] }), { product: "PTFE tape", location: AUSTIN_TEXT }),
    code("NOT_CONFIGURED"),
  );
});

test("OSM tag classification and hint parsing", () => {
  assert.equal(classifyOsmTags({ shop: "electronics" }), "electronics");
  assert.equal(classifyOsmTags({ shop: "trade", trade: "plumbing" }), "plumbing_supplies");
  assert.equal(classifyOsmTags({ shop: "trade", trade: "carpenter" }), null);
  assert.equal(classifyOsmTags({ shop: "hardware;doityourself" }), "hardware");
  assert.deepEqual(parseStoreHints(["hardware", "plumbing", "sanitary", "home improvement"]), [
    "hardware", "plumbing_supplies", "bathroom_furnishing", "doityourself",
  ]);
  assert.ok(storeWeightsForCategory("video adapters").get("electronics") === 1);
  assert.ok(storeWeightsForCategory("some new leaf", "Plumbing").has("plumbing_supplies"));
  assert.equal(storeWeightsForCategory("mystery").size, 0);
});
