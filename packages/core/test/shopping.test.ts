import assert from "node:assert/strict";
import { test } from "node:test";
import { InMemoryShoppingListStore } from "../src/memory";
import { createShoppingList } from "../src/shopping";
import { makeCtx } from "./helpers";

test("items resolve to catalogue names, keep notes and quantities, and are persisted", async () => {
  const ctx = makeCtx();
  const out = await createShoppingList(ctx, {
    items: [
      { product: "teflon tape", quantity: 2, notes: " for pipe threads " },
      { product: "gaffer's favourite widget", quantity: 1 },
    ],
  });
  assert.deepEqual(out.items, ["PTFE tape ×2 — for pipe threads", "gaffer's favourite widget ×1"]);
  const stored = (ctx.shoppingLists as InMemoryShoppingListStore).lists.get(out.listId);
  assert.deepEqual(stored?.map((i) => i.product), ["PTFE tape", "gaffer's favourite widget"]);
  assert.equal(stored?.[0]?.notes, "for pipe threads");
  assert.equal(stored?.[1]?.notes, undefined);
});
