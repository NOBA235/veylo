import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createCoreServices, createLoopbackCaller, createToolExecutor,
  type InventoryEvidenceProvider, type ToolCaller, type WebSearchProvider,
} from "@veylo/core";
import { AUSTIN_TEXT, makeCtx, type CtxOverrides } from "@veylo/core/testing";
import { runAgent } from "../src/agent";

const KILLER = "I need that little thing that lets me connect my laptop to a TV. I don't know what it's called.";
const PTFE = "I need the white tape plumbers use around pipe threads.";

// Test doubles for evidence sources.
const listing: InventoryEvidenceProvider = {
  name: "test listing",
  lookup: async ({ place, product }) =>
    place.id === "osm:node/1" && product === "USB-C to HDMI adapter"
      ? [{ kind: "product_listed", source: "store website", sourceType: "web", timestamp: "2026-10-06T10:00:00.000Z", confidence: 0.72, firstParty: true, summary: "Online product listing found; shelf stock not shown." }]
      : [],
};
const inStock: InventoryEvidenceProvider = {
  name: "test stock feed",
  lookup: async ({ place, product }) =>
    place.id === "osm:node/4" && product === "PTFE tape"
      ? [{ kind: "in_stock_confirmed", source: "store inventory feed", sourceType: "store", timestamp: "2026-10-06T10:00:00.000Z", confidence: 0.95, summary: "Inventory feed reports 12 in stock." }]
      : [],
};
const web: WebSearchProvider = { name: "test web", search: async () => [{ title: "Adapter page", url: "https://shop.example/adapter", snippet: "s" }] };

function harness(over: CtxOverrides = {}) {
  const ctx = makeCtx(over);
  const inner = createLoopbackCaller(createToolExecutor(createCoreServices(ctx), ctx.logger));
  const calls: Array<{ name: string; input: Record<string, unknown> }> = [];
  const caller = { call: async (name: string, input: Record<string, unknown>) => { calls.push({ name, input }); return (inner.call as (n: string, i: unknown) => Promise<unknown>)(name, input); } } as unknown as ToolCaller;
  return { ctx, caller, calls, names: () => calls.map((c) => c.name) };
}
const noDuplicates = (calls: Array<{ name: string; input: unknown }>) =>
  assert.equal(new Set(calls.map((c) => `${c.name}:${JSON.stringify(c.input)}`)).size, calls.length, "a tool was called twice with the same input");

test("first turn: after identifying, it asks local-vs-online instead of searching", async () => {
  const h = harness();
  const r = await runAgent(h.caller, { message: KILLER });
  assert.deepEqual(h.names(), ["identify_product"]);
  assert.equal(r.status, "needs_input");
  assert.equal(r.question?.field, "urgency");
  assert.match(r.question?.text ?? "", /today.*online/i);
  assert.equal(r.state.identified?.product, "USB-C to HDMI adapter");
});

test("killer demo, second turn: discover, check, compare, details, directions in exactly 8 calls, no repeats", async () => {
  const h = harness({ evidenceProviders: [listing] });
  const first = await runAgent(h.caller, { message: KILLER });
  h.calls.length = 0;
  const r = await runAgent(h.caller, { urgency: "today", location: AUSTIN_TEXT }, { state: first.state });
  assert.deepEqual(h.names(), [
    "discover_local_places", "check_local_inventory", "check_local_inventory", "check_local_inventory",
    "check_local_inventory", "compare_products", "get_place_details", "get_directions",
  ]);
  noDuplicates(h.calls);
  assert.equal(r.stepsUsed, 8);
  assert.deepEqual([r.status, r.stopReason], ["done", "complete"]);
  assert.equal(r.best?.placeId, "osm:node/1");
  assert.equal(r.best?.status, "LIKELY");
  assert.match(r.best?.directionsUrl ?? "", /^https:\/\/www\.google\.com\/maps\/dir\//);
});

test("the answer never overstates stock", async () => {
  const h = harness({ evidenceProviders: [listing] });
  const first = await runAgent(h.caller, { message: KILLER });
  const r = await runAgent(h.caller, { urgency: "today", location: AUSTIN_TEXT }, { state: first.state });
  assert.match(r.answer, /likely, but not confirmed/);
  assert.match(r.answer, /no evidence either way/);
  assert.match(r.answer, /prices|price/i);
  assert.ok(!/stock confirmed/i.test(r.answer));
  assert.ok(!/\b(has|have) (it|the)\b/i.test(r.answer));
});

test("trace is inspectable: step, tool, summaries, decision, provider and confidence change", async () => {
  const h = harness({ evidenceProviders: [listing] });
  const first = await runAgent(h.caller, { message: KILLER });
  const r = await runAgent(h.caller, { urgency: "today", location: AUSTIN_TEXT }, { state: first.state });
  assert.deepEqual(r.trace.map((t) => t.step), r.trace.map((_, i) => i + 1));
  const ident = r.trace[0]!;
  assert.deepEqual([ident.tool, ident.provider], ["identify_product", "rules"]);
  assert.ok(ident.confidenceChange && ident.confidenceChange.to > 0.7);
  assert.ok(r.trace.every((t) => t.decision.length > 10));
  const check = r.trace.find((t) => t.tool === "check_local_inventory")!;
  assert.match(check.outputSummary ?? "", /^LIKELY/);
  assert.equal(check.evidenceAdded, 2);
  assert.ok(r.trace.some((t) => t.kind === "ask"), "the earlier clarification is recorded");
});

test("ambiguous request asks a product question and uses no other tool; the answer resumes it", async () => {
  const h = harness();
  const first = await runAgent(h.caller, { message: "I need a cable for my phone", urgency: "today", location: AUSTIN_TEXT });
  assert.deepEqual(h.names(), ["identify_product"]);
  assert.equal(first.question?.field, "product");
  assert.match(first.question?.text ?? "", /Lightning/);
  const second = await runAgent(h.caller, { answer: "It's an iPhone with a Lightning port" }, { state: first.state });
  assert.equal(second.state.identified?.product, "Lightning cable");
  const identifyStep = second.trace.filter((t) => t.tool === "identify_product");
  assert.equal(identifyStep.length, 2);
  assert.ok(identifyStep[1]!.confidenceChange!.from! < identifyStep[1]!.confidenceChange!.to, "confidence rose after the answer");
});

test("urgency known but no location: asks where, without searching", async () => {
  const h = harness();
  const r = await runAgent(h.caller, { message: KILLER, urgency: "today" });
  assert.equal(r.question?.field, "location");
  assert.deepEqual(h.names(), ["identify_product"]);
});

test("online path: web research is used if available, never local tools", async () => {
  const withWeb = harness({ webSearch: web });
  const r = await runAgent(withWeb.caller, { message: KILLER, urgency: "online" });
  assert.deepEqual(withWeb.names(), ["identify_product", "search_web"]);
  assert.equal(r.stopReason, "online_path");
  assert.match(r.answer, /don't show stock/);
  const without = harness();
  const r2 = await runAgent(without.caller, { message: KILLER, urgency: "online" });
  assert.equal(r2.status, "done");
  assert.equal(r2.trace.find((t) => t.tool === "search_web")?.error?.code, "NOT_CONFIGURED");
  assert.match(r2.answer, /couldn't look it up on the web/);
});

test("an unknown place asks for a location again instead of failing", async () => {
  const h = harness();
  const r = await runAgent(h.caller, { message: KILLER, urgency: "today", location: "Nowhere" });
  assert.equal(r.question?.field, "location");
  assert.equal(r.state.location, undefined);
  assert.equal(r.trace.find((t) => t.tool === "discover_local_places")?.error?.code, "GEOCODE_FAILED");
});

test("no stores nearby: widens the radius once, then reports honestly", async () => {
  const h = harness({ places: [] });
  const r = await runAgent(h.caller, { message: KILLER, urgency: "today", location: AUSTIN_TEXT });
  const discover = h.calls.filter((c) => c.name === "discover_local_places");
  assert.deepEqual(discover.map((c) => c.input.radiusMeters), [5000, 15000]);
  assert.deepEqual([r.status, r.stopReason], ["done", "no_places"]);
  assert.match(r.answer, /couldn't find a relevant store within 15 km/);
});

test("confirmed stock ends the search early: no other store is checked", async () => {
  const h = harness({ evidenceProviders: [inStock] });
  const r = await runAgent(h.caller, { message: PTFE, urgency: "today", location: AUSTIN_TEXT });
  const stores = h.calls.filter((c) => c.name === "check_local_inventory" && c.input.product === "PTFE tape").map((c) => c.input.storeId);
  assert.deepEqual(stores, ["osm:node/4"]);
  assert.equal(r.best?.status, "CONFIRMED");
  assert.match(r.answer, /stock confirmed/);
  noDuplicates(h.calls);
});

test("second demo generalises with no evidence: every store is UNKNOWN and says so", async () => {
  const h = harness();
  const r = await runAgent(h.caller, { message: PTFE, urgency: "today", location: AUSTIN_TEXT });
  assert.equal(r.state.identified?.product, "PTFE tape");
  assert.ok(Object.values(r.state.checks).every((c) => c.status === "UNKNOWN"));
  assert.ok(!/stock confirmed|likely/i.test(r.answer));
  assert.match(r.answer, /no evidence either way/);
});

test("requirements make comparison worthwhile even at high confidence", async () => {
  const h = harness();
  const r = await runAgent(h.caller, { message: "usb c to hdmi adapter", urgency: "today", location: AUSTIN_TEXT, requirements: { extraPorts: true } });
  assert.ok(r.state.identified!.confidence >= 0.9);
  assert.ok(h.names().includes("compare_products"));
  assert.match(r.state.comparison?.recommendation ?? "", /^USB-C hub with HDMI/);
});

test("the step budget is a hard cap and the loop degrades gracefully", async () => {
  for (let max = 1; max <= 10; max++) {
    const h = harness({ evidenceProviders: [listing] });
    const first = await runAgent(h.caller, { message: KILLER });
    h.calls.length = 0;
    const r = await runAgent(h.caller, { urgency: "today", location: AUSTIN_TEXT }, { state: first.state, maxSteps: max });
    assert.ok(h.calls.length <= max, `max ${max}: ${h.calls.length} calls`);
    assert.equal(r.stepsUsed, h.calls.length);
    noDuplicates(h.calls);
    if (max < 8) assert.ok(["stopped", "done"].includes(r.status));
    if (max >= 8) assert.equal(r.stopReason, "complete");
  }
  const h = harness({ evidenceProviders: [listing] });
  const first = await runAgent(h.caller, { message: KILLER });
  const tight = await runAgent(h.caller, { urgency: "today", location: AUSTIN_TEXT }, { state: first.state, maxSteps: 3 });
  assert.equal(tight.stopReason, "step_limit");
  assert.match(tight.answer, /Nearby options/, "partial results are still reported");
  assert.equal(tight.best?.placeId, "osm:node/1");
});

test("a failing tool is recorded once and never retried", async () => {
  const h = harness({ evidenceProviders: [listing] });
  const first = await runAgent(h.caller, { message: KILLER });
  const flaky = { call: async (name: string, input: unknown) => {
    if (name === "get_directions") throw Object.assign(new Error("down"), { code: "UPSTREAM_UNAVAILABLE" });
    return (h.caller.call as (n: string, i: unknown) => Promise<unknown>)(name, input);
  } } as unknown as ToolCaller;
  const r = await runAgent(flaky, { urgency: "today", location: AUSTIN_TEXT }, { state: first.state });
  assert.equal(r.trace.filter((t) => t.tool === "get_directions").length, 1);
  assert.equal(r.trace.find((t) => t.tool === "get_directions")?.error?.code, "UNEXPECTED");
  assert.deepEqual(r.state.failed, ["directions"]);
  assert.equal(r.stopReason, "complete");
});

test("state survives JSON serialisation between turns, and a new message starts fresh", async () => {
  const h = harness({ evidenceProviders: [listing] });
  const first = await runAgent(h.caller, { message: KILLER });
  const revived = JSON.parse(JSON.stringify(first.state));
  const r = await runAgent(h.caller, { urgency: "today", location: AUSTIN_TEXT }, { state: revived });
  assert.equal(r.status, "done");
  const fresh = await runAgent(h.caller, { message: PTFE }, { state: r.state });
  assert.equal(fresh.state.identified?.product, "PTFE tape");
  assert.deepEqual(fresh.state.checks, {});
  await assert.rejects(runAgent(h.caller, {}), /needs `message`/);
});

test("changing location discards the old search", async () => {
  const h = harness({ evidenceProviders: [listing] });
  const first = await runAgent(h.caller, { message: KILLER, urgency: "today", location: AUSTIN_TEXT });
  assert.ok(Object.keys(first.state.checks).length > 0);
  const moved = await runAgent(h.caller, { location: "Nowhere" }, { state: first.state });
  assert.equal(moved.question?.field, "location");
  assert.deepEqual(moved.state.checks, {});
});
