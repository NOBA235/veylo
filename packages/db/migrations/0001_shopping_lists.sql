-- 0001_shopping_lists.sql: persistence for the create_shopping_list tool.

CREATE TABLE shopping_lists (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE shopping_list_items (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id    uuid        NOT NULL REFERENCES shopping_lists (id) ON DELETE CASCADE,
  position   integer     NOT NULL,
  product    text        NOT NULL,
  quantity   integer     NOT NULL CHECK (quantity > 0),
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shopping_list_items_list_idx ON shopping_list_items (list_id, position);
