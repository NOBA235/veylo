import assert from "node:assert/strict";
import { test } from "node:test";
import { TOOL_NAMES, toolContracts } from "@veylo/types";
import { z } from "zod";
import { inputShape, outputShape } from "../src/schema-shapes";
import { assertSpecSupport, REQUIRED_PROTOCOL_VERSION, SERVER_INSTRUCTIONS } from "../src/spec";
import { TOOL_META } from "../src/tool-meta";

test("every tool has non-empty input and output shapes derived from its contract", () => {
  for (const name of TOOL_NAMES) {
    assert.ok(Object.keys(inputShape(name)).length > 0, `${name} input`);
    assert.ok(Object.keys(outputShape(name)).length > 0, `${name} output`);
  }
});
test("the refined inventory output exposes its base shape to the SDK (the full schema still guards results)", () => {
  assert.ok("status" in outputShape("check_local_inventory"));
  assert.equal(toolContracts.check_local_inventory.output instanceof z.ZodEffects, true);
});
test("registered input shapes behave like the contract, including defaults", () => {
  const parsed = z.object(inputShape("create_shopping_list")).parse({ items: [{ product: "PTFE tape" }] });
  assert.equal(parsed.items[0]?.quantity, 1);
  assert.equal(z.object(inputShape("identify_product")).safeParse({}).success, false);
});
test("every tool has a title and honest annotations; only create_shopping_list writes", () => {
  for (const name of TOOL_NAMES) assert.ok(TOOL_META[name].title.length > 5, name);
  const writers = TOOL_NAMES.filter((n) => !TOOL_META[n].annotations.readOnlyHint);
  assert.deepEqual(writers, ["create_shopping_list"]);
  assert.ok(TOOL_NAMES.every((n) => !TOOL_META[n].annotations.destructiveHint));
});
test("spec guard rejects an SDK that lacks the targeted protocol version", () => {
  assert.throws(() => assertSpecSupport(["2025-06-18", "2025-03-26"]), /targets MCP 2025-11-25/);
  assert.doesNotThrow(() => assertSpecSupport([REQUIRED_PROTOCOL_VERSION, "2025-06-18"]));
});
test("server instructions carry the honesty rules to the calling agent", () => {
  assert.match(SERVER_INSTRUCTIONS, /only CONFIRMED means current stock/);
  assert.match(SERVER_INSTRUCTIONS, /clarifyingQuestion/);
});
