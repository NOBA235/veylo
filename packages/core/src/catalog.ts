// Domain model for the product knowledge base, independent of storage.
// Keep AliasType / RelationshipType in sync with packages/db/src/schema.ts.

export type AliasType = "synonym" | "colloquial" | "description" | "abbreviation" | "misspelling";
export type RelationshipType =
  | "alternative"
  | "compatible_with"
  | "replacement_for"
  | "used_with"
  | "often_confused_with";

export interface CatalogAlias {
  text: string;
  type: AliasType;
}
export interface CatalogEvidence {
  source: string;
  sourceType: string;
  observedAt: string; // ISO-8601
  confidence: number;
  summary: string;
}
export interface CatalogRelationship {
  type: RelationshipType;
  direction: "from" | "to"; // from: this product -> other; to: other -> this product
  other: string; // canonical name of the other product
}
export interface CatalogProduct {
  id: string;
  name: string;
  category: string;
  parentCategory: string | null;
  description: string;
  brand: string | null;
  aliases: CatalogAlias[];
  useCases: string[];
  compatibility: string[];
  attributes: Record<string, unknown>;
  relationships: CatalogRelationship[];
  evidence: CatalogEvidence[];
}

export interface ProductRepository {
  loadCatalog(): Promise<CatalogProduct[]>;
}
