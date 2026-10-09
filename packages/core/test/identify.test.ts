import assert from "node:assert/strict";
import { test } from "node:test";
import { toolContracts } from "@veylo/types";
import type { IdentifyAssist } from "../src/assist";
import { identifyProduct } from "../src/identify";
import { makeCtx } from "./helpers";

const KILLER = "I need that little thing that lets me connect my laptop to a TV. I don't know what it's called.";
const PTFE = "I need the white tape plumbers use around pipe threads.";
const parse = (out: unknown) => toolContracts.identify_product.output.parse(out);

test("killer demo: laptop-to-TV description identifies the USB-C to HDMI adapter above 0.7", async () => {
  const out = parse(await identifyProduct(makeCtx(), { description: KILLER }));
  assert.equal(out.product, "USB-C to HDMI adapter");
  assert.ok(out.confidence > 0.7, `confidence ${out.confidence}`);
  assert.ok(out.alternatives.includes("USB-C hub with HDMI"));
  assert.ok(out.alternatives.includes("USB-C to HDMI cable"));
  assert.equal(out.meta?.provider, "rules");
});

test("second demo: white thread tape identifies PTFE tape above 0.7", async () => {
  const out = parse(await identifyProduct(makeCtx(), { description: PTFE }));
  assert.equal(out.product, "PTFE tape");
  assert.equal(out.category, "plumbing consumables");
  assert.ok(out.confidence > 0.7, `confidence ${out.confidence}`);
});

test("uncertainty is always reported, never blank", async () => {
  const out = await identifyProduct(makeCtx(), { description: KILLER });
  assert.ok(out.uncertainty.length > 0);
  assert.match(out.uncertainty, /USB-C port/);
});

test("ambiguous 'cable for my phone' asks which connector instead of guessing", async () => {
  const out = parse(await identifyProduct(makeCtx(), { description: "I need a cable for my phone" }));
  assert.ok(out.confidence < 0.75);
  assert.match(out.clarifyingQuestion ?? "", /Lightning/);
  assert.match(out.clarifyingQuestion ?? "", /USB-C/);
  assert.match(out.clarifyingQuestion ?? "", /Micro-USB/);
});

test("stating compatibility resolves the same ambiguity", async () => {
  const out = await identifyProduct(makeCtx(), {
    description: "I need a cable for my phone",
    constraints: { compatibility: "iPhone with a Lightning port" },
  });
  assert.equal(out.product, "Lightning cable");
});

test("'HDMI adapter' alone is a tie between source connectors, so it asks", async () => {
  const out = await identifyProduct(makeCtx(), { description: "HDMI adapter" });
  assert.match(out.clarifyingQuestion ?? "", /connector/i);
});

test("exact alias wins with high confidence", async () => {
  const out = await identifyProduct(makeCtx(), { description: "pen drive" });
  assert.equal(out.product, "USB flash drive");
  assert.ok(out.confidence >= 0.95);
  assert.equal(out.clarifyingQuestion, undefined);
});

test("a misspelling is matched through trigram correction and reported as fuzzy", async () => {
  const out = await identifyProduct(makeCtx(), { description: "usb c hdmi adpter" });
  assert.equal(out.product, "USB-C to HDMI adapter");
  assert.match(out.reasoningSummary, /spelling variant/);
});

test("nothing recognisable returns 'unidentified' with zero confidence and a question", async () => {
  const out = parse(await identifyProduct(makeCtx(), { description: "quantum flux capacitor" }));
  assert.equal(out.product, "unidentified");
  assert.equal(out.confidence, 0);
  assert.ok(out.clarifyingQuestion);
});

test("an image URL is acknowledged as not analysed", async () => {
  const out = await identifyProduct(makeCtx(), { description: KILLER, imageUrl: "https://example.com/x.jpg" });
  assert.match(out.uncertainty, /image was not analysed/i);
});

// ---- AI assist behaviour. The assists below are test doubles standing in for a real provider. ----
const assistReturning = (result: Record<string, unknown>, provider: IdentifyAssist["provider"] = "bedrock"): IdentifyAssist => ({
  provider,
  modelId: "test-model",
  identify: async () => result as never,
});
const base = { category: "cables", reasoning: "", alternatives: [], uncertainty: "" };

test("assist result is used and attributed to its provider", async () => {
  const ctx = makeCtx({ identifyAssist: assistReturning({ ...base, product: "USB-C to HDMI adapter", confidence: 0.93 }) });
  const out = parse(await identifyProduct(ctx, { description: KILLER }));
  assert.equal(out.product, "USB-C to HDMI adapter");
  assert.equal(out.confidence, 0.93);
  assert.deepEqual([out.meta?.provider, out.meta?.modelId], ["bedrock", "test-model"]);
});

test("assist cannot push a product the rules ranked poorly above 0.7", async () => {
  const ctx = makeCtx({ identifyAssist: assistReturning({ ...base, product: "Wireless charging pad", confidence: 0.99 }) });
  const out = await identifyProduct(ctx, { description: KILLER });
  assert.equal(out.product, "Wireless charging pad");
  assert.ok(out.confidence <= 0.7);
});

test("assist proposing an uncatalogued product is capped at 0.6 and flagged", async () => {
  const ctx = makeCtx({ identifyAssist: assistReturning({ ...base, category: "Not A Category", product: "Thunderbolt dock", confidence: 0.95 }) });
  const out = parse(await identifyProduct(ctx, { description: "dock thing" }));
  assert.equal(out.product, "Thunderbolt dock");
  assert.equal(out.category, "uncategorised");
  assert.ok(out.confidence <= 0.6);
  assert.match(out.uncertainty, /not .*catalogue|catalogue has no entry/i);
});

test("assist failure falls back to the rules result and records why", async () => {
  const failing: IdentifyAssist = { provider: "bedrock", identify: async () => { throw new Error("AccessDeniedException"); } };
  const ctx = makeCtx({ identifyAssist: failing });
  const out = parse(await identifyProduct(ctx, { description: KILLER }));
  assert.equal(out.product, "USB-C to HDMI adapter");
  assert.equal(out.meta?.provider, "rules");
  assert.equal(out.meta?.fallbackFrom, "bedrock");
  assert.match(out.meta?.fallbackReason ?? "", /AccessDenied/);
  assert.equal(ctx.warnings.length, 1);
});

test("a malformed assist response is treated as a failure", async () => {
  const ctx = makeCtx({ identifyAssist: assistReturning({ product: "USB-C to HDMI adapter", confidence: 7, alternatives: [] }) });
  const out = await identifyProduct(ctx, { description: KILLER });
  assert.equal(out.meta?.provider, "rules");
  assert.match(out.meta?.fallbackReason ?? "", /confidence/);
});
