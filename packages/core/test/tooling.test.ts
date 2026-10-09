import assert from "node:assert/strict";
import { test } from "node:test";
import { TOOL_NAMES } from "@veylo/types";
import { createCoreServices } from "../src/services";
import { createLoopbackCaller, createToolExecutor, decodeToolResult, ToolCallError } from "../src/tooling";
import { makeCtx } from "./helpers";

const setup = (override: Record<string, unknown> = {}) => {
  const ctx = makeCtx();
  const services = { ...createCoreServices(ctx), ...override } as ReturnType<typeof createCoreServices>;
  return { ctx, handlers: createToolExecutor(services, ctx.logger) };
};

test("every contract tool has a handler", () => {
  assert.deepEqual(Object.keys(setup().handlers).sort(), [...TOOL_NAMES].sort());
});

test("success returns JSON text and structuredContent that agree, and decodes back to the typed output", async () => {
  const { handlers } = setup();
  const result = await handlers.identify_product({ description: "pen drive" });
  assert.equal(result.isError, undefined);
  assert.deepEqual(JSON.parse(result.content[0]!.text), result.structuredContent);
  assert.equal(decodeToolResult("identify_product", result).product, "USB flash drive");
});

test("invalid input is a tool error naming the field, not a crash", async () => {
  const { handlers } = setup();
  const result = await handlers.identify_product({});
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /^INVALID_INPUT: description/);
  assert.throws(() => decodeToolResult("identify_product", result), (e) => e instanceof ToolCallError && e.code === "INVALID_INPUT");
  assert.equal((await handlers.create_shopping_list({ items: [] })).isError, true);
});

test("domain errors keep their code and details across the wire", async () => {
  const { handlers } = setup();
  const result = await handlers.check_local_inventory({ storeId: "nope", product: "PTFE tape" });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent, undefined, "errors must not carry structuredContent");
  assert.throws(
    () => decodeToolResult("check_local_inventory", result),
    (e) => e instanceof ToolCallError && e.code === "NOT_FOUND" && e.details?.storeId === "nope",
  );
});

test("unexpected exceptions are reported generically and never leak internals", async () => {
  const { handlers, ctx } = setup({ identify_product: async () => { throw new Error("password=hunter2 at db-host"); } });
  const result = await handlers.identify_product({ description: "x" });
  assert.equal(result.isError, true);
  assert.ok(!JSON.stringify(result).includes("hunter2"));
  assert.match(result.content[0]!.text, /^INTERNAL_ERROR/);
  assert.equal(ctx.warnings.length, 1);
});

test("a result that violates its contract is withheld (CONFIRMED without evidence never leaves the server)", async () => {
  const bad = async () => ({ store: "s", product: "p", status: "CONFIRMED", confidence: 0.99, evidence: [], nextAction: "go" });
  const { handlers, ctx } = setup({ check_local_inventory: bad });
  const result = await handlers.check_local_inventory({ storeId: "x", product: "p" });
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /^INTERNAL_ERROR/);
  assert.equal(ctx.warnings.length, 1);
});

test("decoding rejects payloads that do not match the contract", () => {
  const forged = { content: [{ type: "text" as const, text: "{}" }], structuredContent: { product: 5 } };
  assert.throws(() => decodeToolResult("identify_product", forged), (e) => e instanceof ToolCallError && e.code === "INVALID_RESULT");
  const notJson = { content: [{ type: "text" as const, text: "hello" }] };
  assert.throws(() => decodeToolResult("identify_product", notJson), (e) => e instanceof ToolCallError && e.code === "INVALID_RESULT");
});

test("loopback caller round-trips typed calls and throws ToolCallError on tool errors", async () => {
  const caller = createLoopbackCaller(setup().handlers);
  const out = await caller.call("search_products", { query: "plumber's tape", limit: 1 });
  assert.equal(out.products[0]?.canonicalName, "PTFE tape");
  await assert.rejects(caller.call("get_place_details", { placeId: "nope" }), (e) => e instanceof ToolCallError && e.code === "NOT_FOUND");
});
