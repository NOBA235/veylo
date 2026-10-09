// End-to-end: the real Streamable HTTP server (official SDK + Express), exercised by (a) the SDK-free
// conformance client and (b) the official SDK client through @veylo/mcp-client.
// Skipped automatically when the MCP SDK / Express are not installed.
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { TOOL_NAMES } from "@veylo/types";
import { runConformance } from "../src/conformance";

const installed = await Promise.all([
  import("@modelcontextprotocol/sdk/server/mcp.js"),
  import("express"),
]).then(() => true, () => false);
const skip = installed ? false : "MCP SDK / Express not installed";

async function withServer(opts: { token?: string; jsonResponse: boolean }, fn: (url: string) => Promise<void>) {
  const { createApp } = await import("../src/http");
  const { createMcpServer } = await import("../src/server");
  const { makeCtx } = await import("@veylo/core/testing");
  const { createCoreServices, createToolExecutor } = await import("@veylo/core");
  const ctx = makeCtx();
  const handlers = createToolExecutor(createCoreServices(ctx), ctx.logger);
  const app = createApp({
    createServer: () => createMcpServer(handlers),
    guard: { allowedOrigins: [], authToken: opts.token },
    jsonResponse: opts.jsonResponse,
    logger: ctx.logger!,
  });
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  try {
    await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}/mcp`);
  } finally {
    await new Promise((r) => server.close(r));
  }
}

test("conformance passes over JSON responses", { skip }, async () => {
  await withServer({ jsonResponse: true }, async (url) => {
    const results = await runConformance(url);
    const failed = results.filter((r) => !r.ok);
    assert.deepEqual(failed, [], JSON.stringify(failed, null, 2));
  });
});

test("conformance passes over SSE responses with bearer auth enforced", { skip }, async () => {
  await withServer({ jsonResponse: false, token: "test-token" }, async (url) => {
    const results = await runConformance(url, { token: "test-token" });
    const failed = results.filter((r) => !r.ok);
    assert.deepEqual(failed, [], JSON.stringify(failed, null, 2));
    assert.ok(results.some((r) => r.name.includes("bearer token")), "auth check ran");
  });
});

test("the official SDK client can list and call tools through @veylo/mcp-client", { skip }, async () => {
  const { VeyloMcpClient } = await import("@veylo/mcp-client");
  const { ToolCallError } = await import("@veylo/core");
  await withServer({ jsonResponse: true }, async (url) => {
    const client = await VeyloMcpClient.connect({ url });
    try {
      assert.deepEqual((await client.listTools()).map((t) => t.name).sort(), [...TOOL_NAMES].sort());
      assert.equal((await client.call("identify_product", { description: "pen drive" })).product, "USB flash drive");
      const near = await client.call("discover_local_places", { product: "PTFE tape", location: "30.2672,-97.7431" });
      assert.deepEqual(near.places.map((p) => p.id), ["osm:node/4", "osm:node/6", "osm:node/5"]);
      await assert.rejects(client.call("get_place_details", { placeId: "nope" }), (e) => e instanceof ToolCallError && e.code === "NOT_FOUND");
      assert.equal((await client.call("create_shopping_list", { items: [{ product: "teflon tape" }] })).items[0], "PTFE tape ×1");
    } finally {
      await client.close();
    }
  });
});
