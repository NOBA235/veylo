import assert from "node:assert/strict";
import { test } from "node:test";
import { TOOL_NAMES } from "@veylo/types";
import { parseRpcBody, runConformance, SAMPLE_ARGS } from "../src/conformance";

test("parseRpcBody reads plain JSON and SSE-framed JSON-RPC, skipping notifications", () => {
  const msg = { jsonrpc: "2.0", id: 1, result: { ok: true } };
  assert.deepEqual(parseRpcBody("application/json", JSON.stringify(msg)), msg);
  const sse = `event: message\ndata: {"jsonrpc":"2.0","method":"notifications/progress"}\n\nevent: message\ndata: ${JSON.stringify(msg)}\n\n`;
  assert.deepEqual(parseRpcBody("text/event-stream", sse), msg);
  assert.equal(parseRpcBody("application/json", "  "), undefined);
});

test("every contract tool has sample input for the conformance run", () => {
  assert.deepEqual(Object.keys(SAMPLE_ARGS).sort(), [...TOOL_NAMES].sort());
});

// The checker itself is verified with scripted responses that are deliberately WRONG, so we know it
// can fail. (These are not a server; the real server is exercised in mcp.e2e.test.ts.)
const scripted = (respond: (body: { method?: string }) => { status?: number; body?: unknown }): typeof fetch =>
  (async (_url: unknown, init: { method?: string; body?: string }) => {
    const parsed = init.body ? (JSON.parse(init.body) as { method?: string }) : {};
    const r = respond(parsed);
    return new Response(r.body === undefined ? "" : JSON.stringify(r.body), { status: r.status ?? 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;

test("checker fails a server that negotiates an older protocol version", async () => {
  const results = await runConformance("http://x/mcp", {
    fetchFn: scripted((b) => b.method === "initialize"
      ? { body: { jsonrpc: "2.0", id: 1, result: { protocolVersion: "2025-06-18", serverInfo: { name: "veylo" }, capabilities: { tools: {} } } } }
      : { status: 404 }),
  });
  const init = results[0]!;
  assert.equal(init.ok, false);
  assert.match(init.detail ?? "", /protocolVersion 2025-06-18/);
});

test("checker fails a server that lists the wrong tools, and never throws on a dead server", async () => {
  const listing = await runConformance("http://x/mcp", {
    fetchFn: scripted((b) => b.method === "tools/list"
      ? { body: { jsonrpc: "2.0", id: 3, result: { tools: [{ name: "identify_product", description: "d", inputSchema: { type: "object" }, outputSchema: {} }] } } }
      : { status: 404 }),
  });
  const list = listing.find((r) => r.name.startsWith("tools/list"))!;
  assert.equal(list.ok, false);
  assert.match(list.detail ?? "", /tools were \[identify_product\]/);

  const dead = await runConformance("http://x/mcp", { fetchFn: (async () => { throw new Error("ECONNREFUSED"); }) as unknown as typeof fetch });
  assert.ok(dead.length >= 8 && dead.every((r) => !r.ok && /ECONNREFUSED/.test(r.detail ?? "")));
});
