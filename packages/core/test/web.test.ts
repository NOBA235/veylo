import assert from "node:assert/strict";
import { test } from "node:test";
import { toolContracts } from "@veylo/types";
import { VeyloError } from "../src/errors";
import { BraveSearchProvider, searchWeb, type WebSearchProvider } from "../src/web";
import { makeCtx } from "./helpers";

const provider = (results: Array<{ title: string; url: string; snippet: string }>, record?: string[], fail = false): WebSearchProvider => ({
  name: "test provider",
  search: async (q) => { record?.push(q); if (fail) throw new Error("boom"); return results; },
});
const code = (c: string) => (e: unknown) => e instanceof VeyloError && e.code === c;

test("without a provider the tool says it is not configured", async () => {
  await assert.rejects(searchWeb(makeCtx(), { query: "usb c hdmi adapter" }), code("NOT_CONFIGURED"));
});

test("results are WEB_FOUND-only, timestamped, limited, and unsafe URLs are dropped", async () => {
  const seen: string[] = [];
  const ctx = makeCtx({
    webSearch: provider([
      { title: "A", url: "https://a.example/p", snippet: "a" },
      { title: "Bad", url: "javascript:alert(1)", snippet: "x" },
      { title: "B", url: "http://b.example", snippet: "b" },
      { title: "C", url: "https://c.example", snippet: "c" },
    ], seen),
  });
  const out = toolContracts.search_web.output.parse(await searchWeb(ctx, { query: "usb c hdmi adapter", location: "Austin", limit: 2 }));
  assert.equal(out.trust, "WEB_FOUND");
  assert.deepEqual(out.results.map((r) => r.title), ["A", "B"]);
  assert.equal(out.results[0]?.retrievedAt, "2026-10-06T12:00:00.000Z");
  assert.match(out.note, /do(es)? not show current stock/);
  assert.deepEqual(seen, ["usb c hdmi adapter Austin"]);
});

test("provider failure is an upstream error and is logged", async () => {
  const ctx = makeCtx({ webSearch: provider([], undefined, true) });
  await assert.rejects(searchWeb(ctx, { query: "x" }), code("UPSTREAM_UNAVAILABLE"));
  assert.equal(ctx.warnings.length, 1);
});

test("Brave adapter: request shape, tag stripping, filtering and HTTP errors (fetch is injected)", async () => {
  let captured: { url: URL; headers: Record<string, string> } | undefined;
  const fakeFetch = (async (url: URL, init: { headers: Record<string, string> }) => {
    captured = { url, headers: init.headers };
    return { ok: true, json: async () => ({ web: { results: [
      { title: "<b>HDMI</b> adapter", url: "https://shop.example/a", description: "Fits <strong>USB-C</strong> &amp; more" },
      { title: "no url" },
    ] } }) };
  }) as unknown as typeof fetch;
  const results = await new BraveSearchProvider("key-123", fakeFetch).search("hdmi adapter", 50);
  assert.deepEqual(results, [{ title: "HDMI adapter", url: "https://shop.example/a", snippet: "Fits USB-C & more" }]);
  assert.equal(captured?.url.searchParams.get("q"), "hdmi adapter");
  assert.equal(captured?.url.searchParams.get("count"), "20");
  assert.equal(captured?.headers["X-Subscription-Token"], "key-123");

  const failing = (async () => ({ ok: false, status: 429 })) as unknown as typeof fetch;
  await assert.rejects(new BraveSearchProvider("k", failing).search("x", 5), /HTTP 429/);
});
