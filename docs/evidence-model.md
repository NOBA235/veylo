# Evidence model and matching

Veylo never states something about a store it cannot support. Every local result carries an inventory state and the evidence behind it.

## Inventory trust states

| State | Meaning | What it takes |
| --- | --- | --- |
| `CONFIRMED` | Explicit current stock evidence | A stock signal from a **store, API or user report**, observed within the last 24 hours. A web page saying "in stock" never counts. |
| `LIKELY` | Strong relevance, stock not confirmed | Store-type fit of at least 0.6 **and** a first-party listing of the product (store's own site or feed). A stale or future-dated stock claim degrades to this. |
| `WEB_FOUND` | A web source mentions the product at this business | Any web signal that does not meet `LIKELY`. |
| `UNKNOWN` | Not enough evidence | Everything else, including "right kind of store" with no product-specific signal. |

`discover_local_places` always returns `UNKNOWN`: appearing in a place listing is not evidence of stock. The `check_local_inventory` output schema rejects `CONFIRMED` or `LIKELY` with no evidence and `WEB_FOUND` without a web record, and the tests include a sweep over signal kinds, sources, ages and fits asserting `CONFIRMED` only ever appears with fresh store/API/user stock evidence.

Evidence records carry `source`, `sourceType`, `timestamp`, `confidence`, `evidenceSummary`. The store-type match itself is recorded as `osm` evidence whose summary says it does not show the product is in stock.

## Numbers are ordinal, not probabilities

- Inventory confidence: `UNKNOWN` 0.1-0.3, `WEB_FOUND` 0.35-0.55, `LIKELY` 0.55-0.8 (each scaled by store-type fit); `CONFIRMED` at least 0.9. These order the states; they are not calibrated likelihoods.
- Identification confidence is the best match score, reduced when the runner-up is within 0.1. It is a ranking heuristic. Treat 0.75 as "ask a question below this".
- Place details evidence is fixed at 0.5: community-maintained listings, possibly out of date.

## Product category to store type

`packages/core/src/store-categories.ts` maps each catalogue category to weighted store types (for example `plumbing consumables` -> hardware 1.0, home improvement 1.0, plumbing supply 1.0, bathroom/sanitary 0.6; `video adapters` -> electronics 1.0, computer 0.9, mobile phone 0.6). Weights are relevance, not proof. Places are ordered by `0.7 * fit + 0.3 * proximity`; `relevanceScore` reports fit alone. Callers can override with `storeCategories` hints ("hardware", "sanitary", "home improvement"). If neither the product nor a hint maps to store types, the tool errors with `UNKNOWN_CATEGORY` instead of guessing. OSM tag selectors for each store type live in the same file (`OSM_SELECTORS`) and drive Phase 7's Overpass query.

## How identification matches

1. **Exact alias or name** (0.98).
2. **Phrase containment**: a known name or alias appears in the description (0.89-0.95; a match covered by a longer match of another product is dropped, so "USB-C to HDMI cable" beats "HDMI cable").
3. **Spelling correction**: unknown words of 5+ letters are replaced by the closest catalogue word (trigram similarity >= 0.5, a port of pg_trgm); hits that needed correction are labelled `fuzzy` and discounted.
4. **Semantic overlap** (up to 0.92): idf-weighted F-measure between the query and each alias, use case and description, plus a lower-weighted product-level coverage score so a conjunction like "cable" + "phone" spread across a product's fields counts.

Then the optional AI assist runs (see `architecture.md`). Clarification fires when confidence is below 0.75, when close candidates sit in different categories, or when a close call turns on a functional difference. Questions are built from the tied candidates' attributes ("Which connector does your device have: Lightning, USB-C or Micro-USB?").

## Known limits

- The rules matcher only understands words that appear in the catalogue. A paraphrase with none of them ("something to unblock the sink") scores low and triggers a question. Closing that gap is what the AI provider is for.
- Catalogue: 69 curated products. Seed evidence is `curated` and says nothing about stock.
- No prices anywhere: there is no verified price source, so `compare_products` says so and does not rank on price.
- Place store and evidence ledger are in memory (single process) until Phase 7 persists them.
- `compare_products` understands three requirement keys: `compatibility`, `extraPorts`, `urgency`. Other keys are reported as "Not evaluated".
