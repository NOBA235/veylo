import assert from "node:assert/strict";
import { test } from "node:test";
import { toolContracts } from "@veylo/types";
import { searchProducts } from "../src/search";
import { makeCtx } from "./helpers";

const search = async (input: Parameters<typeof searchProducts>[1]) =>
  toolContracts.search_products.output.parse(await searchProducts(makeCtx(), input)).products.map((p) => p.canonicalName);

test("alias search finds the product", async () => {
  assert.equal((await search({ query: "plumber's tape" }))[0], "PTFE tape");
});

test("category filter accepts a parent category", async () => {
  const names = await search({ query: "tape", category: "Plumbing" });
  assert.ok(names.includes("PTFE tape"));
  assert.ok(!names.includes("Duct tape"));
});

test("attribute filter matches scalar values", async () => {
  const names = await search({ query: "cable", attributes: { connectorA: "Lightning" } });
  assert.ok(names.includes("Lightning cable"));
  assert.ok(!names.includes("Micro-USB cable"));
});

test("attribute filter matches inside array values", async () => {
  assert.equal((await search({ query: "hdmi hub", attributes: { ports: "USB-A" } }))[0], "USB-C hub with HDMI");
});

test("category browsing lists the category when the text matches nothing", async () => {
  assert.deepEqual(await search({ query: "zzzz", category: "networking" }), ["Ethernet to USB-C adapter", "Wi-Fi range extender"]);
});

test("limit is respected and evidence is labelled as curated catalogue data", async () => {
  const out = toolContracts.search_products.output.parse(await searchProducts(makeCtx(), { query: "cable", limit: 3 }));
  assert.equal(out.products.length, 3);
  assert.match(out.products[0]?.evidence[0] ?? "", /^\[curated\] veylo-seed-v1/);
});
