-- 0000_init.sql: Veylo product knowledge schema (Phase 1).
-- This file is the DDL source of truth. src/schema.ts mirrors the columns for typed queries.
-- Target: PostgreSQL 13+ (gen_random_uuid is built in) and Supabase.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE categories (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL UNIQUE,
  parent_id   uuid        REFERENCES categories (id) ON DELETE SET NULL,
  description text        NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX categories_parent_idx ON categories (parent_id);

CREATE TABLE products (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name text        NOT NULL UNIQUE,
  description    text        NOT NULL DEFAULT '',
  category_id    uuid        NOT NULL REFERENCES categories (id),
  brand          text,
  attributes     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  use_cases      jsonb       NOT NULL DEFAULT '[]'::jsonb,
  aliases        jsonb       NOT NULL DEFAULT '[]'::jsonb,  -- denormalised copy of the aliases table
  compatibility  jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_category_idx       ON products (category_id);
CREATE INDEX products_name_trgm_idx      ON products USING gin (canonical_name gin_trgm_ops);
CREATE INDEX products_use_cases_gin_idx  ON products USING gin (use_cases);
CREATE INDEX products_attributes_gin_idx ON products USING gin (attributes);

CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER products_set_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE aliases (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid        NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  alias      text        NOT NULL,
  alias_type text        NOT NULL DEFAULT 'synonym'
             CHECK (alias_type IN ('synonym', 'colloquial', 'description', 'abbreviation', 'misspelling')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX aliases_product_alias_uq ON aliases (product_id, lower(alias));
CREATE INDEX aliases_lower_alias_idx         ON aliases (lower(alias));
CREATE INDEX aliases_alias_trgm_idx          ON aliases USING gin (alias gin_trgm_ops);

-- alternative / often_confused_with are symmetric (stored once, queried both ways).
-- replacement_for: "from" is the modern replacement for "to". used_with / compatible_with are directional.
CREATE TABLE product_relationships (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  from_product_id   uuid        NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  to_product_id     uuid        NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  relationship_type text        NOT NULL
                    CHECK (relationship_type IN
                      ('alternative', 'compatible_with', 'replacement_for', 'used_with', 'often_confused_with')),
  note              text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (from_product_id <> to_product_id),
  UNIQUE (from_product_id, to_product_id, relationship_type)
);
CREATE INDEX product_relationships_to_idx ON product_relationships (to_product_id);

CREATE TABLE product_evidence (
  id               uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       uuid             NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  source           text             NOT NULL,
  source_type      text             NOT NULL
                   CHECK (source_type IN ('curated', 'web', 'api', 'osm', 'store', 'user', 'ai_inferred')),
  observed_at      timestamptz      NOT NULL DEFAULT now(),  -- the spec's "timestamp"
  confidence       double precision NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  evidence_summary text             NOT NULL,
  created_at       timestamptz      NOT NULL DEFAULT now()
);
CREATE INDEX product_evidence_product_idx ON product_evidence (product_id);
