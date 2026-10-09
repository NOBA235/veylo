import { z } from "zod";
import { Confidence, Evidence, InventoryStatus, ProviderMeta, Urgency } from "./common";

/* 9.1 identify_product */
export const IdentifyProductInput = z.object({
  description: z.string().min(1),
  visualDescription: z.string().optional(),
  imageUrl: z.string().url().optional(),
  constraints: z
    .object({
      location: z.string().optional(),
      urgency: Urgency.optional(),
      budget: z.string().optional(),
      compatibility: z.string().optional(),
    })
    .optional(),
});
export const IdentifyProductOutput = z.object({
  product: z.string(),
  category: z.string(),
  confidence: Confidence,
  reasoningSummary: z.string(),
  alternatives: z.array(z.string()),
  aliases: z.array(z.string()),
  uncertainty: z.string(),
  clarifyingQuestion: z.string().optional(),
  meta: ProviderMeta.optional(),
});

/* 9.2 search_products */
export const SearchProductsInput = z.object({
  query: z.string().min(1),
  category: z.string().optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
  limit: z.number().int().positive().max(50).optional(),
});
export const SearchProductsOutput = z.object({
  products: z.array(
    z.object({
      id: z.string().uuid(),
      canonicalName: z.string(),
      category: z.string(),
      description: z.string(),
      aliases: z.array(z.string()),
      useCases: z.array(z.string()),
      compatibility: z.array(z.string()),
      evidence: z.array(z.string()),
    }),
  ),
});

/* 9.3 discover_local_places */
export const DiscoverLocalPlacesInput = z.object({
  product: z.string().min(1),
  category: z.string().optional(),
  location: z.string().min(1),
  radiusMeters: z.number().int().positive().max(50_000).optional(),
  storeCategories: z.array(z.string()).optional(),
});
export const DiscoverLocalPlacesOutput = z.object({
  places: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      category: z.string(),
      address: z.string().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      distanceMeters: z.number().nonnegative().optional(),
      source: z.string(),
      relevanceScore: Confidence,
      inventoryStatus: InventoryStatus,
      evidenceSummary: z.string(),
    }),
  ),
});

/* 9.4 check_local_inventory: trust invariants are enforced by the schema itself */
export const CheckLocalInventoryInput = z.object({
  storeId: z.string().min(1),
  product: z.string().min(1),
  location: z.string().optional(),
});
export const CheckLocalInventoryOutputBase = z.object({
  store: z.string(),
  product: z.string(),
  status: InventoryStatus,
  confidence: Confidence,
  evidence: z.array(Evidence),
  nextAction: z.string(),
});
export const CheckLocalInventoryOutput = CheckLocalInventoryOutputBase.superRefine((v, ctx) => {
  if (v.status === "CONFIRMED" && v.evidence.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["evidence"],
      message: "CONFIRMED requires at least one evidence record",
    });
  }
  if (v.status === "LIKELY" && v.evidence.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["evidence"],
      message: "LIKELY requires at least one evidence record",
    });
  }
  if (v.status === "WEB_FOUND" && !v.evidence.some((e) => e.sourceType === "web")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["evidence"],
      message: "WEB_FOUND requires at least one web evidence record",
    });
  }
});

/* 9.5 compare_products */
export const CompareProductsInput = z.object({
  products: z.array(z.string().min(1)).min(2),
  userRequirements: z.record(z.string(), z.unknown()).optional(),
  location: z.string().optional(),
});
export const CompareProductsOutput = z.object({
  recommendation: z.string(),
  reasoningSummary: z.string(),
  comparison: z.array(
    z.object({
      product: z.string(),
      pros: z.array(z.string()),
      cons: z.array(z.string()),
      availability: InventoryStatus,
      distanceMeters: z.number().nonnegative().optional(),
    }),
  ),
  meta: ProviderMeta.optional(),
});

/* 9.6 get_place_details: fields are present only when a source provides them */
export const GetPlaceDetailsInput = z.object({ placeId: z.string().min(1) });
export const GetPlaceDetailsOutput = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string().optional(),
  category: z.string(),
  openingHours: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().url().optional(),
  source: z.string(),
  evidence: z.array(Evidence),
});

/* 9.7 get_directions */
export const DirectionsMode = z.enum(["driving", "walking", "transit"]);
export const GetDirectionsInput = z.object({
  placeId: z.string().min(1),
  origin: z.string().optional(),
  mode: DirectionsMode.optional(),
});
export const GetDirectionsOutput = z.object({
  destination: z.string(),
  url: z.string().url(),
  mode: DirectionsMode,
  source: z.string(),
});

/* 9.8 contact_store: Veylo never places calls or sends messages; it returns a contact action */
export const ContactStoreInput = z.object({
  storeId: z.string().min(1),
  product: z.string().optional(),
  message: z.string().optional(),
});
export const ContactStoreOutput = z.object({
  store: z.string(),
  contactMethod: z.enum(["phone", "website", "none"]),
  phone: z.string().optional(),
  website: z.string().url().optional(),
  actionUrl: z.string().optional(),
  note: z.string(),
  source: z.string(),
});

/* 9.9 search_web: results can never rank above WEB_FOUND */
export const SearchWebInput = z.object({
  query: z.string().min(1),
  location: z.string().optional(),
  limit: z.number().int().positive().max(10).optional(),
});
export const SearchWebOutput = z.object({
  trust: z.literal("WEB_FOUND"),
  results: z.array(
    z.object({
      title: z.string(),
      url: z.string().url(),
      snippet: z.string(),
      retrievedAt: z.string().datetime(),
    }),
  ),
  note: z.string(),
});

/* 9.10 create_shopping_list */
export const CreateShoppingListInput = z.object({
  items: z
    .array(
      z.object({
        product: z.string().min(1),
        quantity: z.number().int().positive().default(1),
        notes: z.string().optional(),
      }),
    )
    .min(1),
});
export const CreateShoppingListOutput = z.object({
  listId: z.string(),
  items: z.array(z.string()),
});

/** Registry consumed by the MCP server, the typed MCP client and the docs generator. */
export const toolContracts = {
  identify_product: {
    description:
      "Turn an ambiguous description of a physical product into a likely product with confidence, alternatives and uncertainty.",
    input: IdentifyProductInput,
    output: IdentifyProductOutput,
  },
  search_products: {
    description: "Search the product knowledge base by name, alias, category, use case or attribute.",
    input: SearchProductsInput,
    output: SearchProductsOutput,
  },
  discover_local_places: {
    description: "Find real nearby businesses whose category fits a product. Does not imply stock.",
    input: DiscoverLocalPlacesInput,
    output: DiscoverLocalPlacesOutput,
  },
  check_local_inventory: {
    description:
      "Return an evidence-backed inventory status (CONFIRMED, LIKELY, WEB_FOUND, UNKNOWN) for a product at a store.",
    input: CheckLocalInventoryInput,
    output: CheckLocalInventoryOutput,
  },
  compare_products: {
    description: "Compare candidate products on fit, availability confidence and distance.",
    input: CompareProductsInput,
    output: CompareProductsOutput,
  },
  get_place_details: {
    description: "Return address, category, hours and contact details when a source provides them.",
    input: GetPlaceDetailsInput,
    output: GetPlaceDetailsOutput,
  },
  get_directions: {
    description: "Return a directions URL to a place.",
    input: GetDirectionsInput,
    output: GetDirectionsOutput,
  },
  contact_store: {
    description: "Return a contact action (phone or website) for a store. Never places calls itself.",
    input: ContactStoreInput,
    output: ContactStoreOutput,
  },
  search_web: {
    description: "Web research fallback. Results are WEB_FOUND at most, never verified inventory.",
    input: SearchWebInput,
    output: SearchWebOutput,
  },
  create_shopping_list: {
    description: "Turn identified products into a shopping list.",
    input: CreateShoppingListInput,
    output: CreateShoppingListOutput,
  },
} as const;

export type ToolName = keyof typeof toolContracts;
export const TOOL_NAMES = Object.keys(toolContracts) as ToolName[];

/* Inferred TypeScript types (value and type share a name, so one import gives both). */
export type IdentifyProductInput = z.infer<typeof IdentifyProductInput>;
export type IdentifyProductOutput = z.infer<typeof IdentifyProductOutput>;
export type SearchProductsInput = z.infer<typeof SearchProductsInput>;
export type SearchProductsOutput = z.infer<typeof SearchProductsOutput>;
export type DiscoverLocalPlacesInput = z.infer<typeof DiscoverLocalPlacesInput>;
export type DiscoverLocalPlacesOutput = z.infer<typeof DiscoverLocalPlacesOutput>;
export type CheckLocalInventoryInput = z.infer<typeof CheckLocalInventoryInput>;
export type CheckLocalInventoryOutput = z.infer<typeof CheckLocalInventoryOutput>;
export type CompareProductsInput = z.infer<typeof CompareProductsInput>;
export type CompareProductsOutput = z.infer<typeof CompareProductsOutput>;
export type GetPlaceDetailsInput = z.infer<typeof GetPlaceDetailsInput>;
export type GetPlaceDetailsOutput = z.infer<typeof GetPlaceDetailsOutput>;
export type GetDirectionsInput = z.infer<typeof GetDirectionsInput>;
export type GetDirectionsOutput = z.infer<typeof GetDirectionsOutput>;
export type ContactStoreInput = z.infer<typeof ContactStoreInput>;
export type ContactStoreOutput = z.infer<typeof ContactStoreOutput>;
export type SearchWebInput = z.infer<typeof SearchWebInput>;
export type SearchWebOutput = z.infer<typeof SearchWebOutput>;
export type CreateShoppingListInput = z.infer<typeof CreateShoppingListInput>;
export type CreateShoppingListOutput = z.infer<typeof CreateShoppingListOutput>;
