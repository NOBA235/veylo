import type { ToolArgs, ToolOutput } from "./tool-types";
import { compareProducts } from "./compare";
import type { CoreContext } from "./context";
import { contactStore, getDirections, getPlaceDetails } from "./details";
import { identifyProduct } from "./identify";
import { checkLocalInventory } from "./inventory";
import { discoverLocalPlaces } from "./places";
import { searchProducts } from "./search";
import { createShoppingList } from "./shopping";
import { searchWeb } from "./web";

/** One handler per MCP tool, receiving validated arguments. The MCP server registers exactly these. */
export interface CoreServices {
  identify_product(i: ToolArgs<"identify_product">): Promise<ToolOutput<"identify_product">>;
  search_products(i: ToolArgs<"search_products">): Promise<ToolOutput<"search_products">>;
  discover_local_places(i: ToolArgs<"discover_local_places">): Promise<ToolOutput<"discover_local_places">>;
  check_local_inventory(i: ToolArgs<"check_local_inventory">): Promise<ToolOutput<"check_local_inventory">>;
  compare_products(i: ToolArgs<"compare_products">): Promise<ToolOutput<"compare_products">>;
  get_place_details(i: ToolArgs<"get_place_details">): Promise<ToolOutput<"get_place_details">>;
  get_directions(i: ToolArgs<"get_directions">): Promise<ToolOutput<"get_directions">>;
  contact_store(i: ToolArgs<"contact_store">): Promise<ToolOutput<"contact_store">>;
  search_web(i: ToolArgs<"search_web">): Promise<ToolOutput<"search_web">>;
  create_shopping_list(i: ToolArgs<"create_shopping_list">): Promise<ToolOutput<"create_shopping_list">>;
}

export function createCoreServices(ctx: CoreContext): CoreServices {
  return {
    identify_product: (i) => identifyProduct(ctx, i),
    search_products: (i) => searchProducts(ctx, i),
    discover_local_places: (i) => discoverLocalPlaces(ctx, i),
    check_local_inventory: (i) => checkLocalInventory(ctx, i),
    compare_products: (i) => compareProducts(ctx, i),
    get_place_details: (i) => getPlaceDetails(ctx, i),
    get_directions: (i) => getDirections(ctx, i),
    contact_store: (i) => contactStore(ctx, i),
    search_web: (i) => searchWeb(ctx, i),
    create_shopping_list: (i) => createShoppingList(ctx, i),
  };
}
