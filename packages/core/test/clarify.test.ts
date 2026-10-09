import assert from "node:assert/strict";
import { test } from "node:test";
import { contextClarification } from "../src/clarify";

test("unknown urgency asks local-vs-online first", () => {
  assert.match(contextClarification({}) ?? "", /today.*online/i);
  assert.match(contextClarification({ location: "Austin" }) ?? "", /today.*online/i);
});
test("local urgency without a location asks where", () => {
  assert.match(contextClarification({ urgency: "today" }) ?? "", /Where/);
  assert.match(contextClarification({ urgency: "this_week", location: "  " }) ?? "", /Where/);
});
test("enough context asks nothing", () => {
  assert.equal(contextClarification({ urgency: "today", location: "Austin, TX" }), undefined);
  assert.equal(contextClarification({ urgency: "online" }), undefined);
});
