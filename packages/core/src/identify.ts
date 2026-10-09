import type { IdentifyProductInput, IdentifyProductOutput } from "@veylo/types";
import type { IdentifyAssist, IdentifyAssistResult } from "./assist";
import type { CatalogProduct } from "./catalog";
import type { Candidate, CatalogIndex } from "./catalog-index";
import { CONFIDENT_THRESHOLD, productClarification } from "./clarify";
import type { CoreContext } from "./context";
import { clamp, round2, unique } from "./util";

type Draft = Omit<IdentifyProductOutput, "meta">;

const MAX_ALTERNATIVES = 4;
const MARGIN_PENALTY_WINDOW = 0.1;
/** The AI may not push confidence above this for a product the rules ranked outside their top 3. */
const OFF_SHORTLIST_CAP = 0.7;
/** Cap for a product the AI proposes that is not in the catalogue at all. */
const NOVEL_PRODUCT_CAP = 0.6;

const pct = (n: number) => `${Math.round(n * 100)}%`;

function relatedNames(p: CatalogProduct, type: "alternative" | "often_confused_with"): string[] {
  return unique(p.relationships.filter((r) => r.type === type).map((r) => r.other));
}

function describeStage(c: Candidate): string {
  switch (c.stage) {
    case "exact_alias":
      return `Your wording matches the known name or alias "${c.matched}".`;
    case "phrase":
      return `Your description mentions "${c.matched}", a known name for ${c.product.name}.`;
    case "fuzzy":
      return `Your wording is a close spelling variant of "${c.matched}".`;
    default:
      return `Your description overlaps with how ${c.product.name} is described ("${c.matched}").`;
  }
}

function uncertaintyFor(top: CatalogProduct, confidence: number, input: IdentifyProductInput): string {
  const parts: string[] = [];
  if (confidence < CONFIDENT_THRESHOLD) parts.push(`The match is weak (${pct(confidence)}).`);
  const confused = relatedNames(top, "often_confused_with");
  if (confused.length > 0) parts.push(`Often confused with ${confused.join(", ")}.`);
  const compat = top.compatibility[0];
  if (compat) parts.push(`Compatibility: ${compat}.`);
  if (input.imageUrl) parts.push("The image was not analysed: image identification is not enabled.");
  return parts.length > 0 ? parts.join(" ") : "No significant ambiguity found in the catalogue.";
}

function draftFromRanking(ranked: Candidate[], input: IdentifyProductInput): Draft {
  const top = ranked[0];
  if (!top) {
    return {
      product: "unidentified",
      category: "unknown",
      confidence: 0,
      reasoningSummary: "No catalogue entry matched the description.",
      alternatives: [],
      aliases: [],
      uncertainty: "Nothing in the catalogue resembles this description.",
      clarifyingQuestion: productClarification([], 0),
    };
  }
  const second = ranked[1];
  const margin = second ? top.score - second.score : 1;
  const penalty = Math.max(0, MARGIN_PENALTY_WINDOW - margin);
  const confidence = round2(clamp(top.score - penalty, 0, 0.98));
  const alternatives = unique([
    ...relatedNames(top.product, "alternative"),
    ...ranked.slice(1).filter((c) => c.score >= 0.25).map((c) => c.product.name),
  ])
    .filter((n) => n !== top.product.name)
    .slice(0, MAX_ALTERNATIVES);
  return {
    product: top.product.name,
    category: top.product.category,
    confidence,
    reasoningSummary: describeStage(top),
    alternatives,
    aliases: top.product.aliases
      .filter((a) => a.type === "synonym" || a.type === "colloquial")
      .map((a) => a.text)
      .slice(0, 5),
    uncertainty: uncertaintyFor(top.product, confidence, input),
    clarifyingQuestion: productClarification(ranked, confidence),
  };
}

function validateAssistResult(raw: unknown): IdentifyAssistResult {
  const r = raw as Partial<IdentifyAssistResult> | null;
  if (!r || typeof r !== "object") throw new Error("assist returned a non-object");
  if (typeof r.product !== "string" || r.product.trim() === "") throw new Error("assist returned no product");
  if (typeof r.confidence !== "number" || !(r.confidence >= 0 && r.confidence <= 1)) {
    throw new Error("assist returned a confidence outside 0..1");
  }
  if (!Array.isArray(r.alternatives) || !r.alternatives.every((a) => typeof a === "string")) {
    throw new Error("assist returned invalid alternatives");
  }
  return {
    product: r.product.trim(),
    category: typeof r.category === "string" ? r.category : "",
    confidence: r.confidence,
    reasoning: typeof r.reasoning === "string" ? r.reasoning : "",
    alternatives: r.alternatives,
    uncertainty: typeof r.uncertainty === "string" ? r.uncertainty : "",
    clarifyingQuestion:
      typeof r.clarifyingQuestion === "string" && r.clarifyingQuestion.trim() ? r.clarifyingQuestion.trim() : undefined,
  };
}

/** Combine the AI answer with the rules ranking, never letting the AI exceed what the catalogue supports. */
function mergeAssist(
  assist: IdentifyAssist,
  index: CatalogIndex,
  ranked: Candidate[],
  raw: IdentifyAssistResult,
  input: IdentifyProductInput,
): Draft {
  const hit = index.resolve(raw.product);
  const alternativesFrom = (exclude: string, extra: string[]) =>
    unique([...raw.alternatives.map((n) => index.resolve(n)?.name ?? n), ...extra, ...ranked.slice(0, 4).map((c) => c.product.name)])
      .filter((n) => n !== exclude)
      .slice(0, MAX_ALTERNATIVES);

  if (hit) {
    const rank = ranked.findIndex((c) => c.product.name === hit.name);
    const cap = rank >= 0 && rank < 3 ? 0.98 : OFF_SHORTLIST_CAP;
    const confidence = round2(clamp(Math.min(raw.confidence, cap)));
    const agreement =
      rank === 0
        ? "The rules ranking agrees."
        : rank > 0
          ? `The rules ranking placed it #${rank + 1}.`
          : "It was not in the rules shortlist, so its confidence is capped.";
    return {
      product: hit.name,
      category: hit.category,
      confidence,
      reasoningSummary: `${assist.provider} matched the description to ${hit.name} (in the catalogue). ${agreement}${raw.reasoning ? ` ${raw.reasoning}` : ""}`.trim(),
      alternatives: alternativesFrom(hit.name, relatedNames(hit, "alternative")),
      aliases: hit.aliases.filter((a) => a.type === "synonym" || a.type === "colloquial").map((a) => a.text).slice(0, 5),
      uncertainty: raw.uncertainty || uncertaintyFor(hit, confidence, input),
      clarifyingQuestion: raw.clarifyingQuestion ?? productClarification(ranked, confidence),
    };
  }

  const confidence = round2(clamp(Math.min(raw.confidence, NOVEL_PRODUCT_CAP)));
  return {
    product: raw.product,
    category: index.categories.has(raw.category) ? raw.category : "uncategorised",
    confidence,
    reasoningSummary: `${assist.provider} proposed ${raw.product}, which is not in the Veylo catalogue.${raw.reasoning ? ` ${raw.reasoning}` : ""}`,
    alternatives: alternativesFrom(raw.product, []),
    aliases: [],
    uncertainty: `${raw.uncertainty ? `${raw.uncertainty} ` : ""}This comes from the AI provider alone; the catalogue has no entry for it.`,
    clarifyingQuestion:
      raw.clarifyingQuestion ?? (confidence < CONFIDENT_THRESHOLD ? productClarification(ranked, confidence) : undefined),
  };
}

export async function identifyProduct(ctx: CoreContext, input: IdentifyProductInput): Promise<IdentifyProductOutput> {
  const index = await ctx.catalog.get();
  const text = [input.description, input.visualDescription, input.constraints?.compatibility]
    .filter((s): s is string => Boolean(s))
    .join(". ");
  const ranked = index.rank(text, 8);
  const rules: IdentifyProductOutput = { ...draftFromRanking(ranked, input), meta: { provider: "rules" } };

  const assist = ctx.identifyAssist;
  if (!assist) return rules;

  const started = Date.now();
  try {
    const raw = validateAssistResult(
      await assist.identify({
        description: input.description,
        visualDescription: input.visualDescription,
        constraints: input.constraints,
        shortlist: ranked.slice(0, 6).map((c) => ({
          name: c.product.name,
          category: c.product.category,
          description: c.product.description,
          score: round2(c.score),
        })),
        categories: [...index.categories],
      }),
    );
    const draft = mergeAssist(assist, index, ranked, raw, input);
    return { ...draft, meta: { provider: assist.provider, modelId: assist.modelId, latencyMs: Date.now() - started } };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    ctx.logger?.warn("identify assist failed; using rules result", { provider: assist.provider, reason });
    return {
      ...rules,
      meta: { provider: "rules", fallbackFrom: assist.provider, fallbackReason: reason, latencyMs: Date.now() - started },
    };
  }
}
