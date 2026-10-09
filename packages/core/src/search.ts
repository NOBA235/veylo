import type { SearchProductsInput, SearchProductsOutput } from "@veylo/types";
import type { CatalogProduct } from "./catalog";
import type { CoreContext } from "./context";

function attributeMatches(actual: unknown, wanted: unknown): boolean {
  const w = String(wanted).toLowerCase();
  return Array.isArray(actual) ? actual.some((a) => String(a).toLowerCase() === w) : actual !== undefined && String(actual).toLowerCase() === w;
}

function toResult(p: CatalogProduct): SearchProductsOutput["products"][number] {
  return {
    id: p.id,
    canonicalName: p.name,
    category: p.category,
    description: p.description,
    aliases: p.aliases.map((a) => a.text),
    useCases: p.useCases,
    compatibility: p.compatibility,
    evidence: p.evidence.map(
      (e) => `[${e.sourceType}] ${e.source} (${e.observedAt.slice(0, 10)}, confidence ${e.confidence}): ${e.summary}`,
    ),
  };
}

export async function searchProducts(ctx: CoreContext, input: SearchProductsInput): Promise<SearchProductsOutput> {
  const index = await ctx.catalog.get();
  const limit = input.limit ?? 10;
  const cat = input.category?.trim().toLowerCase();
  const inCategory = (p: CatalogProduct) =>
    !cat || p.category.toLowerCase() === cat || p.parentCategory?.toLowerCase() === cat;
  const attrs = Object.entries(input.attributes ?? {});
  const attributesOk = (p: CatalogProduct) => attrs.every(([k, v]) => attributeMatches(p.attributes[k], v));

  let found = index.rank(input.query, 100).map((c) => c.product).filter(inCategory).filter(attributesOk);
  if (found.length === 0 && cat) {
    // Category browsing: nothing matched the text, so list what is in the category.
    found = index.products.filter(inCategory).filter(attributesOk).sort((a, b) => a.name.localeCompare(b.name));
  }
  return { products: found.slice(0, limit).map(toResult) };
}
