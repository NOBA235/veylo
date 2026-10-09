import type { ToolName } from "@veylo/types";

export interface ToolMeta {
  title: string;
  annotations: { readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: boolean };
}
const read = (openWorld: boolean) => ({ readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: openWorld });

export const TOOL_META: Record<ToolName, ToolMeta> = {
  identify_product: { title: "Identify a product from a description", annotations: read(false) },
  search_products: { title: "Search the product knowledge base", annotations: read(false) },
  discover_local_places: { title: "Find nearby stores that fit a product", annotations: read(true) },
  check_local_inventory: { title: "Check stock evidence at a store", annotations: read(true) },
  compare_products: { title: "Compare candidate products", annotations: read(false) },
  get_place_details: { title: "Get store details", annotations: read(true) },
  get_directions: { title: "Get directions to a store", annotations: read(false) },
  contact_store: { title: "Get a way to contact a store", annotations: read(false) },
  search_web: { title: "Search the web (results are never verified stock)", annotations: read(true) },
  create_shopping_list: {
    title: "Create a shopping list",
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
};
