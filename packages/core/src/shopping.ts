import type { CreateShoppingListInput, CreateShoppingListOutput } from "@veylo/types";
import type { CoreContext } from "./context";

export interface ShoppingListItem {
  product: string;
  quantity: number;
  notes?: string;
}
export interface ShoppingListStore {
  create(items: ShoppingListItem[]): Promise<{ id: string }>;
}

const describe = (i: ShoppingListItem) => `${i.product} ×${i.quantity}${i.notes ? ` — ${i.notes}` : ""}`;

/** Names are resolved to catalogue names when the match is strong, otherwise kept as the caller wrote them. */
export async function createShoppingList(
  ctx: CoreContext,
  input: CreateShoppingListInput,
): Promise<CreateShoppingListOutput> {
  const index = await ctx.catalog.get();
  const items: ShoppingListItem[] = input.items.map((i) => ({
    product: index.resolve(i.product)?.name ?? i.product.trim(),
    quantity: i.quantity,
    notes: i.notes?.trim() || undefined,
  }));
  const { id } = await ctx.shoppingLists.create(items);
  return { listId: id, items: items.map(describe) };
}
