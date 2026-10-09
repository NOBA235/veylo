import type { Candidate } from "./catalog-index";
import { joinOr, unique } from "./util";

export const CONFIDENT_THRESHOLD = 0.75;
/** Candidates within this score distance of the best are treated as a genuine tie. */
export const TIE_MARGIN = 0.12;

export function tiedCandidates(ranked: Candidate[]): Candidate[] {
  const top = ranked[0];
  if (!top) return [];
  return ranked.filter((c) => c.score >= top.score - TIE_MARGIN).slice(0, 6);
}

const portsOf = (c: Candidate): string[] => {
  const ports = c.product.attributes.ports;
  return Array.isArray(ports) ? ports.map(String) : [];
};

const ATTRIBUTE_QUESTIONS: Array<[key: string, ask: (values: string[], other: boolean) => string]> = [
  ["connectorA", (v, o) => `Which connector does your device have — ${joinOr(v)}${o ? ", or something else" : ""}?`],
  ["size", (v) => `Which size do you need — ${joinOr(v)}?`],
  ["output", (v) => `Which port should it have — ${joinOr(v)}?`],
  ["formFactor", (v) => `Which form do you prefer — ${joinOr(v)}?`],
];

/** A question that separates the tied candidates on a functional attribute, if one exists. */
function differentiator(tied: Candidate[]): string | undefined {
  const top = tied[0];
  if (!top) return undefined;
  const base = top.product.attributes.connectorB;
  if (typeof base === "string") {
    const withPorts = tied.find((c) => portsOf(c).length > 1 && portsOf(c).includes(base));
    if (withPorts) {
      const extras = portsOf(withPorts).filter((p) => p !== base);
      if (extras.length > 0) return `Do you need just ${base}, or also ${extras.join("/")} ports?`;
    }
  }
  for (const [key, ask] of ATTRIBUTE_QUESTIONS) {
    const values = unique(
      tied.map((c) => c.product.attributes[key]).filter((v): v is string => typeof v === "string"),
    );
    if (values.length >= 2) {
      const someLack = tied.some((c) => typeof c.product.attributes[key] !== "string");
      return ask(values, someLack);
    }
  }
  return undefined;
}

function genericQuestion(options: Candidate[]): string {
  const names = unique(options.map((c) => c.product.name)).slice(0, 3);
  return names.length >= 2
    ? `Did you mean ${joinOr(names)}?`
    : `Do you mean ${names[0] ?? "something specific"}? If not, tell me what it does or what it connects to.`;
}

/**
 * Product-level clarification (clarification policy, section 12):
 * ask when confidence is low, when close candidates sit in different categories,
 * or when a close call hinges on a functional difference.
 */
export function productClarification(ranked: Candidate[], confidence: number): string | undefined {
  if (ranked.length === 0) return "What does it do, or what does it connect to or fit into?";
  const tied = tiedCandidates(ranked);
  const question = tied.length >= 2 ? differentiator(tied) : undefined;
  if (confidence < CONFIDENT_THRESHOLD) {
    return question ?? genericQuestion(tied.length >= 2 ? tied : ranked.slice(0, 1));
  }
  const categories = new Set(tied.map((c) => c.product.category));
  if (tied.length >= 2 && categories.size >= 2) return question ?? genericQuestion(tied);
  return tied.length >= 2 ? question : undefined;
}

/** Local-vs-online and location questions, used by the planner once a product is identified. */
export function contextClarification(ctx: { location?: string; urgency?: string }): string | undefined {
  const urgency = ctx.urgency ?? "unknown";
  if (urgency === "online") return undefined;
  if (urgency === "unknown") return "Do you need it today, or are you okay ordering online?";
  if (!ctx.location?.trim()) return "Where should I look? Tell me your city or area.";
  return undefined;
}
