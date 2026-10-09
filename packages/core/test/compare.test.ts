import assert from "node:assert/strict";
import { test } from "node:test";
import { toolContracts, type CompareProductsOutput } from "@veylo/types";
import type { CompareAssist } from "../src/assist";
import { compareProducts } from "../src/compare";
import { normalize } from "../src/text";
import { AUSTIN_TEXT, makeCtx } from "./helpers";

const THREE = ["USB-C to HDMI adapter", "USB-C hub with HDMI", "USB-C to HDMI cable"];
const parse = (o: unknown) => toolContracts.compare_products.output.parse(o);
const find = (o: CompareProductsOutput, name: string) => o.comparison.find((c) => c.product === name)!;
const entry = (product: string, over = {}) => ({
  placeId: "osm:node/1", store: "Fixture Electronics", product, status: "CONFIRMED" as const,
  confidence: 0.95, distanceMeters: 556, at: "2026-10-06T11:00:00.000Z", ...over,
});

test("without evidence nothing is claimed available, and prices are explicitly not compared", async () => {
  const out = parse(await compareProducts(makeCtx(), { products: THREE }));
  assert.ok(out.comparison.every((c) => c.availability === "UNKNOWN" && c.distanceMeters === undefined));
  assert.ok(out.comparison.every((c) => c.cons.some((x) => /No stock evidence/.test(x))));
  assert.match(out.reasoningSummary, /Prices are not compared/);
  assert.match(out.recommendation, /^USB-C to HDMI adapter/);
  assert.match(out.recommendation, /nothing yet separates/);
});

test("stock evidence from the ledger drives the recommendation and fills availability and distance", async () => {
  const ctx = makeCtx();
  await ctx.ledger.record(entry("USB-C hub with HDMI"));
  const out = parse(await compareProducts(ctx, { products: THREE }));
  assert.match(out.recommendation, /^USB-C hub with HDMI/);
  assert.match(out.recommendation, /stock there is confirmed/);
  const hub = find(out, "USB-C hub with HDMI");
  assert.deepEqual([hub.availability, hub.distanceMeters], ["CONFIRMED", 556]);
  assert.ok(hub.pros.some((p) => /Stock confirmed at Fixture Electronics, 0\.6 km away/.test(p)));
});

test("unconfirmed evidence is never worded as having the item", async () => {
  const ctx = makeCtx();
  await ctx.ledger.record(entry("USB-C hub with HDMI", { status: "LIKELY", confidence: 0.7 }));
  const out = await compareProducts(ctx, { products: THREE });
  assert.match(out.recommendation, /though stock is not confirmed/);
  assert.ok(!/\b(has|have) (it|the)\b/i.test(out.recommendation));
});

test("evidence from a different search location is not used", async () => {
  const ctx = makeCtx();
  await ctx.ledger.record(entry("USB-C hub with HDMI", { searchLocation: normalize("Somewhere Else") }));
  const out = await compareProducts(ctx, { products: THREE, location: AUSTIN_TEXT });
  assert.equal(find(out, "USB-C hub with HDMI").availability, "UNKNOWN");
});

test("stale evidence (older than the session window) is ignored", async () => {
  const ctx = makeCtx();
  await ctx.ledger.record(entry("USB-C hub with HDMI", { at: "2026-10-05T01:00:00.000Z" }));
  assert.equal(find(await compareProducts(ctx, { products: THREE }), "USB-C hub with HDMI").availability, "UNKNOWN");
});

test("requirement: extra ports favours the hub", async () => {
  const out = await compareProducts(makeCtx(), { products: THREE, userRequirements: { extraPorts: true } });
  assert.match(out.recommendation, /^USB-C hub with HDMI/);
});

test("requirement: stated compatibility favours the matching cable", async () => {
  const out = await compareProducts(makeCtx(), { products: ["USB-C cable", "Lightning cable"], userRequirements: { compatibility: "Lightning iPhone" } });
  assert.match(out.recommendation, /^Lightning cable/);
  assert.match(out.recommendation, /stated compatibility/);
  assert.ok(find(out, "USB-C cable").cons.some((c) => /Nothing in the catalogue shows it fits/.test(c)));
});

test("online urgency ignores stock; today urgency boosts it", async () => {
  const ctx = makeCtx();
  await ctx.ledger.record(entry("USB-C hub with HDMI"));
  const online = await compareProducts(ctx, { products: THREE, userRequirements: { urgency: "online" } });
  assert.equal(find(online, "USB-C hub with HDMI").pros.some((p) => /Stock confirmed/.test(p)), false);
  assert.match(online.recommendation, /^USB-C to HDMI adapter/);
});

test("unknown products are reported, not guessed; unevaluated requirement keys are named", async () => {
  const out = parse(await compareProducts(makeCtx(), { products: ["USB-C hub with HDMI", "flux capacitor"], userRequirements: { budget: "cheap" } }));
  assert.match(find(out, "flux capacitor").cons[0]!, /Not in the Veylo catalogue/);
  assert.match(out.recommendation, /^USB-C hub with HDMI/);
  assert.match(out.reasoningSummary, /Not evaluated: budget/);
  const none = await compareProducts(makeCtx(), { products: ["flux capacitor", "warp coil"] });
  assert.match(none.recommendation, /could not compare/i);
});

// ---- AI assist guardrails (test doubles) ----
const assist = (result: unknown, fail = false): CompareAssist => ({
  provider: "bedrock", modelId: "test-model",
  compare: async () => { if (fail) throw new Error("throttled"); return result as never; },
});
const good = {
  recommendation: "USB-C hub with HDMI is the most flexible choice.",
  reasoningSummary: "It adds ports as well as video.",
  notes: [{ product: "USB-C hub with HDMI", pros: ["Adds ports"], cons: ["Bulkier"] }],
};

test("assist can reword pros/cons and recommend, but availability and distance stay evidence-derived", async () => {
  const ctx = makeCtx({ compareAssist: assist(good) });
  await ctx.ledger.record(entry("USB-C to HDMI cable", { status: "WEB_FOUND", confidence: 0.4 }));
  const out = parse(await compareProducts(ctx, { products: THREE }));
  assert.deepEqual([out.meta?.provider, out.meta?.modelId], ["bedrock", "test-model"]);
  assert.match(out.recommendation, /^USB-C hub with HDMI/);
  assert.equal(find(out, "USB-C hub with HDMI").pros[0], "Adds ports");
  assert.equal(find(out, "USB-C to HDMI cable").availability, "WEB_FOUND");
  assert.equal(find(out, "USB-C hub with HDMI").availability, "UNKNOWN");
});

test("assist failure or an unrelated recommendation falls back to rules and restores pros/cons", async () => {
  const failing = parse(await compareProducts(makeCtx({ compareAssist: assist(good, true) }), { products: THREE }));
  assert.equal(failing.meta?.provider, "rules");
  assert.equal(failing.meta?.fallbackFrom, "bedrock");
  const bogus = parse(await compareProducts(makeCtx({ compareAssist: assist({ ...good, recommendation: "Buy a toaster." }) }), { products: THREE }));
  assert.equal(bogus.meta?.provider, "rules");
  assert.match(bogus.meta?.fallbackReason ?? "", /does not name a compared product/);
  assert.ok(!find(bogus, "USB-C hub with HDMI").pros.includes("Adds ports"));
});
