import type { AliasType, CatalogProduct } from "./catalog";
import { indexOfSequence, tokenize, trigramSimilarity } from "./text";

export type MatchStage = "exact_alias" | "phrase" | "fuzzy" | "semantic";

export interface Candidate {
  product: CatalogProduct;
  /** Heuristic 0..1 ordering score. Not a calibrated probability. */
  score: number;
  stage: MatchStage;
  /** The catalogue string that produced the match. */
  matched: string;
}

type DocKind =
  | "name"
  | "synonym"
  | "colloquial"
  | "description_alias"
  | "abbreviation"
  | "misspelling"
  | "use_case"
  | "description"
  | "category";

const KIND_WEIGHT: Record<DocKind, number> = {
  name: 1,
  synonym: 1,
  colloquial: 0.95,
  description_alias: 0.95,
  abbreviation: 0.95,
  misspelling: 0.9,
  use_case: 0.8,
  description: 0.7,
  category: 0.5,
};
const NAME_LIKE = new Set<DocKind>([
  "name",
  "synonym",
  "colloquial",
  "description_alias",
  "abbreviation",
  "misspelling",
]);
const ALIAS_KIND: Record<AliasType, DocKind> = {
  synonym: "synonym",
  colloquial: "colloquial",
  description: "description_alias",
  abbreviation: "abbreviation",
  misspelling: "misspelling",
};

// Stage ceilings: even a perfect semantic overlap is less certain than an exact alias hit.
const CEILING = { exact: 0.98, phraseMax: 0.95, semantic: 0.92 };
// A spelling-corrected exact/phrase hit is less certain than an uncorrected one.
const CORRECTED_FACTOR = 0.93;
// Query words found across a product's aliases, use cases and description (a conjunction signal).
const PRODUCT_COVERAGE_WEIGHT = 0.6;
const MIN_CORRECTION_SIMILARITY = 0.5;
const MIN_SCORE = 0.12;

interface IndexedDoc {
  product: CatalogProduct;
  text: string;
  kind: DocKind;
  tokens: string[];
  joined: string;
  set: Set<string>;
  weight: number;
  nameLike: boolean;
  phraseOk: boolean;
  idfSum: number;
}

/**
 * In-process matcher over the catalogue. Implements, in order: exact alias, phrase containment,
 * trigram fuzzy match, then idf-weighted semantic overlap over aliases, use cases and descriptions.
 */
export class CatalogIndex {
  readonly categories: Set<string>;
  private readonly docs: IndexedDoc[] = [];
  private readonly idf = new Map<string, number>();
  private readonly byLowerName = new Map<string, CatalogProduct>();
  private readonly productTokens = new Map<string, Set<string>>();
  private readonly vocabulary: string[] = [];
  private readonly categoryParents = new Map<string, string | null>();

  constructor(readonly products: CatalogProduct[]) {
    this.categories = new Set();
    const df = new Map<string, number>();
    for (const p of products) {
      this.byLowerName.set(p.name.toLowerCase(), p);
      this.categories.add(p.category);
      this.categoryParents.set(p.category, p.parentCategory);
      if (p.parentCategory) this.categories.add(p.parentCategory);
      const texts: Array<[string, DocKind]> = [
        [p.name, "name"],
        ...p.aliases.map((a): [string, DocKind] => [a.text, ALIAS_KIND[a.type]]),
        ...p.useCases.map((u): [string, DocKind] => [u, "use_case"]),
        [p.description, "description"],
        [[p.category, p.parentCategory ?? ""].join(" "), "category"],
      ];
      const productTokens = new Set<string>();
      for (const [text, kind] of texts) {
        const tokens = tokenize(text);
        if (tokens.length === 0) continue;
        tokens.forEach((t) => productTokens.add(t));
        this.docs.push({
          product: p,
          text,
          kind,
          tokens,
          joined: tokens.join(" "),
          set: new Set(tokens),
          weight: KIND_WEIGHT[kind],
          nameLike: NAME_LIKE.has(kind),
          phraseOk: tokens.length >= 2 || (tokens[0] ?? "").length >= 4,
          idfSum: 0,
        });
      }
      for (const t of productTokens) df.set(t, (df.get(t) ?? 0) + 1);
      this.productTokens.set(p.name, productTokens);
    }
    const n = Math.max(1, products.length);
    for (const [t, c] of df) this.idf.set(t, Math.log(1 + n / c));
    this.vocabulary = [...df.keys()].filter((t) => t.length >= 4);
    for (const d of this.docs) d.idfSum = [...d.set].reduce((s, t) => s + (this.idf.get(t) ?? 0), 0);
  }

  parentCategoryOf(category: string): string | null {
    return this.categoryParents.get(category) ?? null;
  }

  get(name: string): CatalogProduct | undefined {
    return this.byLowerName.get(name.trim().toLowerCase());
  }

  /** Resolve a free-text product name to a catalogue entry, only when the match is strong. */
  resolve(name: string): CatalogProduct | undefined {
    const direct = this.get(name);
    if (direct) return direct;
    const top = this.rank(name, 1)[0];
    if (!top) return undefined;
    return top.stage === "exact_alias" || top.stage === "phrase" || top.score >= 0.8
      ? top.product
      : undefined;
  }

  /** Replace out-of-vocabulary words with the closest catalogue word (trigram similarity). */
  private correct(tokens: string[]): { tokens: string[]; corrected: boolean } {
    let corrected = false;
    const out = tokens.map((t) => {
      if (this.idf.has(t) || t.length < 5) return t;
      let best: string | undefined;
      let bestSim = 0;
      for (const v of this.vocabulary) {
        const sim = trigramSimilarity(t, v);
        if (sim > bestSim) {
          best = v;
          bestSim = sim;
        }
      }
      if (best && bestSim >= MIN_CORRECTION_SIMILARITY) {
        corrected = true;
        return best;
      }
      return t;
    });
    return { tokens: out, corrected };
  }

  rank(text: string, limit = 10): Candidate[] {
    const raw = tokenize(text);
    if (raw.length === 0) return [];
    const { tokens: q, corrected } = this.correct(raw);
    const qJoined = q.join(" ");
    const best = new Map<string, Candidate>();
    const offer = (d: IndexedDoc, score: number, stage: MatchStage) => {
      // After spelling correction every score is discounted, and exact/phrase hits are reported as fuzzy.
      const fuzzy = corrected && (stage === "exact_alias" || stage === "phrase");
      const finalScore = corrected ? score * CORRECTED_FACTOR : score;
      const finalStage: MatchStage = fuzzy ? "fuzzy" : stage;
      const cur = best.get(d.product.name);
      if (!cur || finalScore > cur.score) {
        best.set(d.product.name, { product: d.product, score: finalScore, stage: finalStage, matched: d.text });
      }
    };

    // 1. exact alias / name
    for (const d of this.docs) if (d.nameLike && d.joined === qJoined) offer(d, CEILING.exact, "exact_alias");

    // 2. phrase containment; a match covered by a longer match of another product is dropped
    const phrases: Array<{ d: IndexedDoc; start: number; end: number }> = [];
    for (const d of this.docs) {
      if (!d.nameLike || !d.phraseOk) continue;
      const at = indexOfSequence(q, d.tokens);
      if (at >= 0) phrases.push({ d, start: at, end: at + d.tokens.length });
    }
    for (const m of phrases) {
      const covered = phrases.some(
        (o) =>
          o.d.product !== m.d.product &&
          o.d.tokens.length > m.d.tokens.length &&
          o.start <= m.start &&
          o.end >= m.end,
      );
      if (!covered) offer(m.d, Math.min(CEILING.phraseMax, 0.86 + 0.03 * m.d.tokens.length), "phrase");
    }

    // 3 + 4. semantic overlap: idf-weighted F-measure per alias / use case / description,
    //        plus product-level coverage across all of a product's strings.
    const uniqueQ = [...new Set(q)];
    const known = uniqueQ.filter((t) => this.idf.has(t));
    if (known.length > 0) {
      const denom = known.reduce((s, t) => s + (this.idf.get(t) ?? 0), 0);
      const damp = Math.sqrt(known.length / uniqueQ.length);
      for (const d of this.docs) {
        let num = 0;
        for (const t of known) if (d.set.has(t)) num += this.idf.get(t) ?? 0;
        if (num === 0 || d.idfSum === 0) continue;
        const cov = num / denom;
        const prec = num / d.idfSum;
        const f = (2 * cov * prec) / (cov + prec);
        offer(d, CEILING.semantic * f * d.weight * damp, "semantic");
        // product-level coverage, attributed to this product's canonical-name doc
      }
      for (const p of this.products) {
        const set = this.productTokens.get(p.name);
        if (!set) continue;
        let num = 0;
        for (const t of known) if (set.has(t)) num += this.idf.get(t) ?? 0;
        if (num === 0) continue;
        const pcov = num / denom;
        const doc = this.docs.find((d) => d.product === p && d.kind === "name");
        if (doc) offer(doc, CEILING.semantic * PRODUCT_COVERAGE_WEIGHT * pcov * pcov * damp, "semantic");
      }
    }

    return [...best.values()]
      .filter((c) => c.score >= MIN_SCORE)
      .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name))
      .slice(0, limit);
  }
}
