import assert from "node:assert/strict";
import { test } from "node:test";
import { toolContracts } from "@veylo/types";
import { contactStore, getDirections, getPlaceDetails, normalizeWebsite } from "../src/details";
import { VeyloError } from "../src/errors";
import { FIXTURE_PLACES, fixturePlace, makeCtx } from "./helpers";

async function ctxWithPlaces() {
  const ctx = makeCtx();
  await ctx.placeStore.putMany([...FIXTURE_PLACES, fixturePlace("site-only", "Web Only Shop", "electronics", 0, { website: "web-only.example/shop" })]);
  return ctx;
}

test("details expose only what the source listed, with honest evidence", async () => {
  const ctx = await ctxWithPlaces();
  const full = toolContracts.get_place_details.output.parse(await getPlaceDetails(ctx, { placeId: "osm:node/1" }));
  assert.equal(full.website, "https://fixture-electronics.example");
  assert.equal(full.phone, "+1 512 555 0100");
  assert.equal(full.category, "electronics store");
  assert.match(full.evidence[0]!.evidenceSummary, /Not verified with the store/);
  const bare = await getPlaceDetails(ctx, { placeId: "osm:node/3" });
  assert.equal(bare.phone, undefined);
  assert.equal(bare.openingHours, undefined);
  assert.equal(bare.address, undefined);
});

test("unknown place ids are NOT_FOUND", async () => {
  const ctx = makeCtx();
  for (const fn of [getPlaceDetails, getDirections]) {
    await assert.rejects(fn(ctx, { placeId: "nope" }), (e) => e instanceof VeyloError && e.code === "NOT_FOUND");
  }
  await assert.rejects(contactStore(ctx, { storeId: "nope" }), (e) => e instanceof VeyloError && e.code === "NOT_FOUND");
});

test("directions is a link to the place coordinates and says no routing service was called", async () => {
  const ctx = await ctxWithPlaces();
  const p = FIXTURE_PLACES[0]!;
  const out = toolContracts.get_directions.output.parse(await getDirections(ctx, { placeId: p.id, origin: "Austin, TX", mode: "walking" }));
  const url = new URL(out.url);
  assert.equal(url.origin + url.pathname, "https://www.google.com/maps/dir/");
  assert.equal(url.searchParams.get("destination"), `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`);
  assert.equal(url.searchParams.get("origin"), "Austin, TX");
  assert.equal(url.searchParams.get("travelmode"), "walking");
  assert.equal(out.mode, "walking");
  assert.match(out.source, /no routing service/);
  assert.equal((await getDirections(ctx, { placeId: p.id })).mode, "driving");
});

test("contact: phone first, then website, else an explicit 'none'; never claims to call", async () => {
  const ctx = await ctxWithPlaces();
  const phone = toolContracts.contact_store.output.parse(await contactStore(ctx, { storeId: "osm:node/1", product: "USB-C to HDMI adapter" }));
  assert.equal(phone.contactMethod, "phone");
  assert.equal(phone.actionUrl, "tel:+15125550100");
  assert.match(phone.note, /does not place calls/);
  const site = await contactStore(ctx, { storeId: "site-only" });
  assert.deepEqual([site.contactMethod, site.actionUrl], ["website", "https://web-only.example/shop"]);
  const none = toolContracts.contact_store.output.parse(await contactStore(ctx, { storeId: "osm:node/3" }));
  assert.equal(none.contactMethod, "none");
  assert.equal(none.phone, undefined);
  assert.match(none.note, /lists no phone or website/);
});

test("website normalisation", () => {
  assert.equal(normalizeWebsite("shop.example/a"), "https://shop.example/a");
  assert.equal(normalizeWebsite("http://shop.example"), "http://shop.example");
  assert.equal(normalizeWebsite("   "), undefined);
  assert.equal(normalizeWebsite("not a url at all"), undefined);
  assert.equal(normalizeWebsite(undefined), undefined);
});
