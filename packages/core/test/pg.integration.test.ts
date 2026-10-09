// Runs only when TEST_DATABASE_URL points at a migrated and seeded database
// (docker compose up -d && pnpm db:migrate && pnpm db:seed). Skipped otherwise.
import assert from "node:assert/strict";
import { test } from "node:test";
import { CatalogIndex } from "../src/catalog-index";
import { loadSeedCatalog } from "./helpers";

const url = process.env.TEST_DATABASE_URL;

test("Postgres repository returns the same catalogue the seed files describe", { skip: !url }, async () => {
  const { createDb } = await import("@veylo/db");
  const { createPgProductRepository } = await import("../src/repository/pg");
  const { db, pool } = createDb(url);
  try {
    const fromDb = await createPgProductRepository(db).loadCatalog();
    const fromSeed = loadSeedCatalog();
    assert.equal(fromDb.length, fromSeed.length);
    const a = new CatalogIndex(fromDb);
    const b = new CatalogIndex(fromSeed);
    for (const q of ["connect my laptop to a TV", "white tape plumbers use around pipe threads", "a cable for my phone", "pen drive"]) {
      assert.equal(a.rank(q, 1)[0]?.product.name, b.rank(q, 1)[0]?.product.name, q);
    }
    const hdmi = fromDb.find((p) => p.name === "USB-C to HDMI adapter");
    assert.ok(hdmi && hdmi.aliases.length >= 5 && hdmi.relationships.length >= 3 && hdmi.evidence.length === 1);
  } finally {
    await pool.end();
  }
});
