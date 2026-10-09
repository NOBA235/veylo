import { readFileSync } from "node:fs";
import { and, count, eq } from "drizzle-orm";
import { createDb } from "./client";
import {
  aliases,
  categories,
  productEvidence,
  productRelationships,
  products,
  type AliasType,
  type RelationshipType,
} from "./schema";

const SEED_SOURCE = "veylo-seed-v1";

interface SeedCategory {
  name: string;
  parent: string | null;
  description: string;
}
interface SeedProduct {
  name: string;
  category: string;
  description: string;
  brand?: string | null;
  aliases: Partial<Record<AliasType, string[]>>;
  useCases: string[];
  compatibility: string[];
  attributes: Record<string, unknown>;
}
type SeedRelationship = [from: string, type: RelationshipType, to: string];

function readSeed<T>(file: string): T {
  return JSON.parse(readFileSync(new URL(`../seed/${file}`, import.meta.url), "utf8")) as T;
}

function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Seed error: missing ${what}`);
  return value;
}

async function main() {
  const seedCategories = readSeed<SeedCategory[]>("categories.json");
  const seedProducts = readSeed<SeedProduct[]>("products.json");
  const seedRelationships = readSeed<SeedRelationship[]>("relationships.json");

  const { db, pool } = createDb();
  try {
    await db.transaction(async (tx) => {
      // Categories: upsert by name, then wire parents in a second pass.
      const categoryIds = new Map<string, string>();
      for (const c of seedCategories) {
        const [row] = await tx
          .insert(categories)
          .values({ name: c.name, description: c.description })
          .onConflictDoUpdate({ target: categories.name, set: { description: c.description } })
          .returning({ id: categories.id });
        categoryIds.set(c.name, must(row?.id, `category ${c.name}`));
      }
      for (const c of seedCategories) {
        if (!c.parent) continue;
        await tx
          .update(categories)
          .set({ parentId: must(categoryIds.get(c.parent), `parent category ${c.parent}`) })
          .where(eq(categories.id, must(categoryIds.get(c.name), `category ${c.name}`)));
      }

      // Products, aliases, curated evidence.
      const productIds = new Map<string, string>();
      for (const p of seedProducts) {
        const categoryId = must(categoryIds.get(p.category), `category ${p.category} for ${p.name}`);
        const aliasEntries = (Object.entries(p.aliases) as [AliasType, string[]][]).flatMap(
          ([type, list]) => list.map((alias) => ({ alias, type })),
        );
        const values = {
          canonicalName: p.name,
          description: p.description,
          categoryId,
          brand: p.brand ?? null,
          attributes: p.attributes,
          useCases: p.useCases,
          aliases: aliasEntries.map((a) => a.alias),
          compatibility: p.compatibility,
        };
        const [row] = await tx
          .insert(products)
          .values(values)
          .onConflictDoUpdate({
            target: products.canonicalName,
            set: { ...values, updatedAt: new Date() },
          })
          .returning({ id: products.id });
        const productId = must(row?.id, `product ${p.name}`);
        productIds.set(p.name, productId);

        if (aliasEntries.length > 0) {
          await tx
            .insert(aliases)
            .values(aliasEntries.map((a) => ({ productId, alias: a.alias, aliasType: a.type })))
            .onConflictDoNothing();
        }

        await tx
          .delete(productEvidence)
          .where(and(eq(productEvidence.productId, productId), eq(productEvidence.source, SEED_SOURCE)));
        await tx.insert(productEvidence).values({
          productId,
          source: SEED_SOURCE,
          sourceType: "curated",
          confidence: 0.8,
          evidenceSummary:
            "Hand-curated catalogue entry (names, aliases, use cases). Says nothing about any store's stock.",
        });
      }

      for (const [from, type, to] of seedRelationships) {
        await tx
          .insert(productRelationships)
          .values({
            fromProductId: must(productIds.get(from), `relationship product ${from}`),
            toProductId: must(productIds.get(to), `relationship product ${to}`),
            relationshipType: type,
          })
          .onConflictDoNothing();
      }
    });

    const [c] = await db.select({ n: count() }).from(categories);
    const [p] = await db.select({ n: count() }).from(products);
    const [a] = await db.select({ n: count() }).from(aliases);
    const [r] = await db.select({ n: count() }).from(productRelationships);
    console.log(
      `Seeded: ${c?.n} categories, ${p?.n} products, ${a?.n} aliases, ${r?.n} relationships`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
