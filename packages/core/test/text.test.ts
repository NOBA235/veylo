import assert from "node:assert/strict";
import { test } from "node:test";
import { CatalogIndex } from "../src/catalog-index";
import { normalize, tokenize, trigramSimilarity } from "../src/text";
import { loadSeedCatalog } from "./helpers";

test("trigram similarity matches the pg_trgm documentation example", () => {
  // PostgreSQL docs: similarity('word', 'two words') = 0.363636
  assert.ok(Math.abs(trigramSimilarity("word", "two words") - 0.363636) < 1e-5);
  assert.equal(trigramSimilarity("same", "same"), 1);
});

test("normalisation folds connector names, apostrophes and decimals", () => {
  assert.equal(normalize("USB-C"), "usbc");
  assert.equal(normalize("USB Type-C to HDMI"), "usb typec to hdmi");
  assert.equal(normalize("plumber's tape"), "plumbers tape");
  assert.equal(normalize("3.5mm cable"), "35mm cable");
});

test("tokenize drops filler, stems plurals and applies generic synonyms", () => {
  assert.deepEqual(tokenize("I need the little adaptors for my TVs"), ["small", "adapter", "tv"]);
  assert.deepEqual(tokenize("double A batteries"), ["double", "battery"]);
});

test("USB-A and USB-C stay distinguishable after normalisation", () => {
  assert.notDeepEqual(tokenize("USB-A cable"), tokenize("USB-C cable"));
});

test("index builds over the full seed", () => {
  const idx = new CatalogIndex(loadSeedCatalog());
  assert.equal(idx.products.length, 69);
  assert.equal(idx.resolve("pen drive")?.name, "USB flash drive");
  assert.equal(idx.resolve("completely unrelated gibberish"), undefined);
});
