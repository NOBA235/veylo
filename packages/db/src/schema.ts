import { sql } from "drizzle-orm";
import {
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// Keep these lists in sync with the CHECK constraints in migrations/0000_init.sql.
export const ALIAS_TYPES = [
  "synonym",
  "colloquial",
  "description",
  "abbreviation",
  "misspelling",
] as const;
export type AliasType = (typeof ALIAS_TYPES)[number];

export const RELATIONSHIP_TYPES = [
  "alternative",
  "compatible_with",
  "replacement_for",
  "used_with",
  "often_confused_with",
] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export const EVIDENCE_SOURCE_TYPES = [
  "curated",
  "web",
  "api",
  "osm",
  "store",
  "user",
  "ai_inferred",
] as const;
export type EvidenceSourceType = (typeof EVIDENCE_SOURCE_TYPES)[number];

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  parentId: uuid("parent_id").references((): AnyPgColumn => categories.id, {
    onDelete: "set null",
  }),
  description: text("description").notNull().default(""),
  createdAt: createdAt(),
});

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  canonicalName: text("canonical_name").notNull().unique(),
  description: text("description").notNull().default(""),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => categories.id),
  brand: text("brand"),
  attributes: jsonb("attributes")
    .$type<Record<string, unknown>>()
    .notNull()
    .default(sql`'{}'::jsonb`),
  useCases: jsonb("use_cases")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  aliases: jsonb("aliases")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  compatibility: jsonb("compatibility")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const aliases = pgTable("aliases", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  alias: text("alias").notNull(),
  aliasType: text("alias_type", { enum: ALIAS_TYPES }).notNull().default("synonym"),
  createdAt: createdAt(),
});

export const productRelationships = pgTable("product_relationships", {
  id: uuid("id").primaryKey().defaultRandom(),
  fromProductId: uuid("from_product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  toProductId: uuid("to_product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  relationshipType: text("relationship_type", { enum: RELATIONSHIP_TYPES }).notNull(),
  note: text("note"),
  createdAt: createdAt(),
});

export const productEvidence = pgTable("product_evidence", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  source: text("source").notNull(),
  sourceType: text("source_type", { enum: EVIDENCE_SOURCE_TYPES }).notNull(),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
  confidence: doublePrecision("confidence").notNull(),
  evidenceSummary: text("evidence_summary").notNull(),
  createdAt: createdAt(),
});

export const shoppingLists = pgTable("shopping_lists", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: createdAt(),
});

export const shoppingListItems = pgTable("shopping_list_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  listId: uuid("list_id")
    .notNull()
    .references(() => shoppingLists.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  product: text("product").notNull(),
  quantity: integer("quantity").notNull(),
  notes: text("notes"),
  createdAt: createdAt(),
});
