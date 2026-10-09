// Offline integrity check for the seed data. No database required.
import { readFileSync } from "node:fs";

const read = (f) => JSON.parse(readFileSync(new URL(`../seed/${f}`, import.meta.url), "utf8"));
const categories = read("categories.json");
const products = read("products.json");
const relationships = read("relationships.json");

const ALIAS_TYPES = new Set(["synonym", "colloquial", "description", "abbreviation", "misspelling"]);
const REL_TYPES = new Set([
  "alternative",
  "compatible_with",
  "replacement_for",
  "used_with",
  "often_confused_with",
]);
const MIN_PRODUCTS = 50;
const MIN_CATEGORIES = 20;
const REQUIRED = ["USB-C to HDMI adapter", "PTFE tape"];

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const lc = (s) => s.trim().toLowerCase();

// categories
const catNames = new Set();
for (const c of categories) {
  if (!c.name || !c.description) err(`category missing name/description: ${JSON.stringify(c)}`);
  if (catNames.has(lc(c.name))) err(`duplicate category: ${c.name}`);
  catNames.add(lc(c.name));
}
for (const c of categories) {
  if (c.parent !== null && !catNames.has(lc(c.parent))) err(`category ${c.name}: unknown parent ${c.parent}`);
}
if (categories.length < MIN_CATEGORIES) err(`need >= ${MIN_CATEGORIES} categories, have ${categories.length}`);

// products + aliases
const productNames = new Map();
for (const p of products) productNames.set(lc(p.name), p.name);
const aliasOwner = new Map();
const usedCats = new Set();
let aliasCount = 0;
const seenProducts = new Set();
for (const p of products) {
  if (seenProducts.has(lc(p.name))) err(`duplicate product: ${p.name}`);
  seenProducts.add(lc(p.name));
  if (!catNames.has(lc(p.category))) err(`${p.name}: unknown category ${p.category}`);
  usedCats.add(lc(p.category));
  if (!p.description) err(`${p.name}: empty description`);
  if (!Array.isArray(p.useCases) || p.useCases.length === 0) err(`${p.name}: needs >= 1 use case`);
  if (!Array.isArray(p.compatibility)) err(`${p.name}: compatibility must be an array`);
  if (typeof p.attributes !== "object" || p.attributes === null) err(`${p.name}: attributes must be an object`);
  const entries = Object.entries(p.aliases ?? {});
  const total = entries.reduce((n, [, l]) => n + l.length, 0);
  if (total === 0) err(`${p.name}: needs >= 1 alias`);
  for (const [type, list] of entries) {
    if (!ALIAS_TYPES.has(type)) err(`${p.name}: bad alias type ${type}`);
    for (const alias of list) {
      aliasCount++;
      const key = lc(alias);
      if (productNames.has(key) && productNames.get(key) !== p.name)
        err(`alias "${alias}" on ${p.name} equals canonical name of ${productNames.get(key)}`);
      if (key === lc(p.name)) err(`alias "${alias}" duplicates its own canonical name`);
      const owner = aliasOwner.get(key);
      if (owner && owner !== p.name) err(`alias "${alias}" used by both ${owner} and ${p.name}`);
      aliasOwner.set(key, p.name);
    }
  }
}
if (products.length < MIN_PRODUCTS) err(`need >= ${MIN_PRODUCTS} products, have ${products.length}`);
for (const r of REQUIRED) if (!productNames.has(lc(r))) err(`required product missing: ${r}`);
for (const c of categories) if (!usedCats.has(lc(c.name)) && !categories.some((x) => x.parent && lc(x.parent) === lc(c.name)))
  warnings.push(`category has no products and no children: ${c.name}`);

// relationships
const relSeen = new Set();
const relByType = {};
for (const [from, type, to] of relationships) {
  if (!productNames.has(lc(from))) err(`relationship: unknown product "${from}"`);
  if (!productNames.has(lc(to))) err(`relationship: unknown product "${to}"`);
  if (!REL_TYPES.has(type)) err(`relationship: bad type ${type}`);
  if (lc(from) === lc(to)) err(`relationship: self reference ${from}`);
  const key = `${lc(from)}|${type}|${lc(to)}`;
  if (relSeen.has(key)) err(`relationship: duplicate ${from} ${type} ${to}`);
  relSeen.add(key);
  relByType[type] = (relByType[type] ?? 0) + 1;
}

console.log(
  `categories=${categories.length} products=${products.length} aliases=${aliasCount} relationships=${relationships.length}`,
);
console.log(`relationships by type: ${JSON.stringify(relByType)}`);
for (const w of warnings) console.warn(`warn: ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  process.exit(1);
}
console.log("seed OK");
