// Postgres-backed catalogue repository (Drizzle). Exposed as "@veylo/core/pg" so the pure core has no DB dependency.
import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  aliases, categories, productEvidence, productRelationships, products,
  shoppingListItems, shoppingLists, type Db,
} from "@veylo/db";
import type { CatalogProduct, CatalogRelationship, ProductRepository } from "../catalog";
import type { ShoppingListStore } from "../shopping";

export function createPgProductRepository(db: Db): ProductRepository {
  return {
    async loadCatalog(): Promise<CatalogProduct[]> {
      const parent = alias(categories, "parent_category");
      const rows = await db
        .select({ p: products, category: categories.name, parent: parent.name })
        .from(products)
        .innerJoin(categories, eq(products.categoryId, categories.id))
        .leftJoin(parent, eq(categories.parentId, parent.id));
      const [aliasRows, relRows, evidenceRows] = await Promise.all([
        db.select().from(aliases),
        db.select().from(productRelationships),
        db.select().from(productEvidence),
      ]);

      const nameById = new Map<string, string>(rows.map((r) => [r.p.id, r.p.canonicalName]));
      const rels = new Map<string, CatalogRelationship[]>();
      const push = (id: string, rel: CatalogRelationship) => rels.set(id, [...(rels.get(id) ?? []), rel]);
      for (const r of relRows) {
        const from = nameById.get(r.fromProductId);
        const to = nameById.get(r.toProductId);
        if (!from || !to) continue;
        push(r.fromProductId, { type: r.relationshipType, direction: "from", other: to });
        push(r.toProductId, { type: r.relationshipType, direction: "to", other: from });
      }

      return rows.map(({ p, category, parent: parentName }) => ({
        id: p.id,
        name: p.canonicalName,
        category,
        parentCategory: parentName,
        description: p.description,
        brand: p.brand,
        aliases: aliasRows.filter((a) => a.productId === p.id).map((a) => ({ text: a.alias, type: a.aliasType })),
        useCases: p.useCases,
        compatibility: p.compatibility,
        attributes: p.attributes,
        relationships: rels.get(p.id) ?? [],
        evidence: evidenceRows
          .filter((e) => e.productId === p.id)
          .map((e) => ({
            source: e.source,
            sourceType: e.sourceType,
            observedAt: e.observedAt.toISOString(),
            confidence: e.confidence,
            summary: e.evidenceSummary,
          })),
      }));
    },
  };
}

export function createPgShoppingListStore(db: Db): ShoppingListStore {
  return {
    async create(items) {
      return db.transaction(async (tx) => {
        const [list] = await tx.insert(shoppingLists).values({}).returning({ id: shoppingLists.id });
        if (!list) throw new Error("failed to create shopping list");
        await tx.insert(shoppingListItems).values(
          items.map((it, position) => ({
            listId: list.id,
            position,
            product: it.product,
            quantity: it.quantity,
            notes: it.notes ?? null,
          })),
        );
        return { id: list.id };
      });
    },
  };
}
