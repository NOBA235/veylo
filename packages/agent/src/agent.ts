// Bounded planner loop: observe -> decide -> call tool -> update state -> repeat (max 8 steps per run).
// It reaches Veylo only through a ToolCaller (the MCP client in production). The policy is not a fixed pipeline:
// each decision depends on what earlier results showed, and the loop stops, asks, or skips steps accordingly.
import { contextClarification, ToolCallError, type ToolCaller, type ToolInput, type ToolOutput } from "@veylo/core";
import type { ToolName } from "@veylo/types";
import { buildAnswer, pickBest } from "./answer";
import type { AgentInput, AgentResult, AgentState, StopReason, TraceStep } from "./types";

export const DEFAULT_MAX_STEPS = 8;
const DEFAULT_RADIUS_M = 5000;
const WIDER_RADIUS_M = 15000;
const MAX_MAIN_CHECKS = 3;
const MAX_ALTERNATIVES = 2;
/** Below this the user might prefer an alternative, so it is worth comparing them. */
const COMPARE_BELOW_CONFIDENCE = 0.9;

type Described = Partial<Pick<TraceStep, "outputSummary" | "evidenceAdded" | "confidenceChange" | "provider">>;
type ExecResult<N extends ToolName> = { ok: true; out: ToolOutput<N> } | { ok: false; err: { code: string; message: string } };

const clip = (s: string, n = 80) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const pct = (n: number) => `${Math.round(n * 100)}%`;

function providerLabel(meta: { provider: string; modelId?: string; fallbackFrom?: string; fallbackReason?: string } | undefined) {
  if (!meta) return undefined;
  if (meta.fallbackFrom) return `rules (fallback from ${meta.fallbackFrom}: ${clip(meta.fallbackReason ?? "unknown", 60)})`;
  return meta.modelId ? `${meta.provider} (${meta.modelId})` : meta.provider;
}

function newState(description: string): AgentState {
  return { description, answers: [], radiusMeters: DEFAULT_RADIUS_M, widened: false, checks: {}, altChecks: {}, failed: [], trace: [] };
}
function resetLocal(s: AgentState) {
  s.places = undefined; s.checks = {}; s.altChecks = {}; s.comparison = undefined;
  s.details = undefined; s.directions = undefined; s.widened = false; s.radiusMeters = DEFAULT_RADIUS_M; s.failed = [];
}

export async function runAgent(
  caller: ToolCaller,
  input: AgentInput,
  opts: { state?: AgentState; maxSteps?: number } = {},
): Promise<AgentResult> {
  const maxSteps = opts.maxSteps ?? DEFAULT_MAX_STEPS;
  // A new message always starts a fresh request; otherwise continue from the supplied state.
  let state: AgentState;
  if (input.message !== undefined || !opts.state) {
    if (!input.message?.trim()) throw new Error("runAgent needs `message` on the first turn.");
    state = newState(input.message.trim());
  } else {
    state = structuredClone(opts.state);
    state.failed ??= [];
  }
  if (input.answer?.trim()) {
    state.answers.push(input.answer.trim());
    state.identified = undefined; // re-identify with the new detail
    resetLocal(state);
  }
  if (input.location !== undefined && input.location.trim() !== state.location) {
    state.location = input.location.trim() || undefined;
    resetLocal(state);
  }
  if (input.urgency !== undefined) state.urgency = input.urgency;
  if (input.compatibility !== undefined) state.compatibility = input.compatibility;
  if (input.budget !== undefined) state.budget = input.budget;
  if (input.requirements !== undefined) state.requirements = input.requirements;
  if (input.radiusMeters !== undefined && input.radiusMeters !== state.radiusMeters) {
    state.radiusMeters = input.radiusMeters;
    state.places = undefined;
  }

  let used = 0;
  const seen = new Set<string>();

  const exec = async <N extends ToolName>(
    tool: N,
    toolInput: ToolInput<N>,
    spec: { decision: string; inputSummary: string; describe: (out: ToolOutput<N>) => Described },
  ): Promise<ExecResult<N>> => {
    const key = `${tool}:${JSON.stringify(toolInput)}`;
    if (seen.has(key)) throw new Error(`planner bug: repeated identical call ${key}`);
    seen.add(key);
    used++;
    const step: TraceStep = { step: state.trace.length + 1, kind: "tool", tool, inputSummary: spec.inputSummary, decision: spec.decision };
    try {
      const out = await caller.call(tool, toolInput);
      Object.assign(step, spec.describe(out));
      state.trace.push(step);
      return { ok: true, out };
    } catch (e) {
      const err = e instanceof ToolCallError ? { code: e.code, message: e.message } : { code: "UNEXPECTED", message: e instanceof Error ? e.message : String(e) };
      step.error = err;
      step.outputSummary = `error ${err.code}`;
      state.trace.push(step);
      return { ok: false, err };
    }
  };

  const finish = (status: AgentResult["status"], stopReason: StopReason, extra: { question?: AgentResult["question"]; note?: string } = {}): AgentResult => {
    state.trace.push({
      step: state.trace.length + 1,
      kind: extra.question ? "ask" : "stop",
      decision: extra.question ? "Ambiguity or missing context would change the result, so I ask instead of guessing." : `Stopping: ${stopReason}.`,
      ...(extra.question ? { question: extra.question.text } : {}),
    });
    const bestPlace = pickBest(state);
    const check = bestPlace ? state.checks[bestPlace.id] : undefined;
    return {
      status,
      stopReason,
      question: extra.question,
      answer: extra.question ? extra.question.text : buildAnswer(state, stopReason, extra.note),
      best: bestPlace && check ? { placeId: bestPlace.id, name: bestPlace.name, status: check.status, nextAction: check.nextAction, directionsUrl: state.directions?.url } : undefined,
      trace: state.trace,
      state,
      stepsUsed: used,
    };
  };
  const ask = (field: NonNullable<AgentResult["question"]>["field"], text: string, reason: StopReason) =>
    finish("needs_input", reason, { question: { field, text } });

  for (;;) {
    // 1. Understand: identify before anything else.
    if (!state.identified) {
      if (used >= maxSteps) return finish("stopped", "step_limit");
      const before = state.trace.filter((t) => t.tool === "identify_product").at(-1)?.confidenceChange?.to;
      const description = [state.description, ...state.answers].join(". ");
      const r = await exec("identify_product", { description, constraints: { location: state.location, urgency: state.urgency, budget: state.budget, compatibility: state.compatibility } }, {
        decision: state.answers.length > 0 ? "The user answered my question, so identify again with the new detail." : "Nothing is known about the product yet.",
        inputSummary: `"${clip(description)}"`,
        describe: (o) => ({
          outputSummary: `${o.product}, ${pct(o.confidence)}${o.clarifyingQuestion ? ", question pending" : ""}`,
          confidenceChange: { from: before, to: o.confidence },
          provider: providerLabel(o.meta),
        }),
      });
      if (!r.ok) return finish("stopped", "tool_error", { note: `I couldn't identify the product (${r.err.message}).` });
      state.identified = r.out;
      continue;
    }
    const id = state.identified;

    // 2. Ambiguity that changes the result: ask, don't guess.
    if (id.clarifyingQuestion) return ask("product", id.clarifyingQuestion, "needs_product_detail");

    // 3. Local vs online, and where.
    const contextQuestion = contextClarification({ location: state.location, urgency: state.urgency });
    if (contextQuestion) {
      const field = (state.urgency ?? "unknown") === "unknown" ? "urgency" : "location";
      return ask(field, contextQuestion, field === "urgency" ? "needs_urgency" : "needs_location");
    }

    // 4. Online: web research is optional; its absence is recorded, not fatal.
    if (state.urgency === "online") {
      if (!state.web && !state.webTried && used < maxSteps) {
        state.webTried = true;
        const r = await exec("search_web", { query: `${id.product} buy online`, limit: 3 }, {
          decision: "The user will order online, so look for web sources (never treated as verified stock).",
          inputSummary: `"${id.product} buy online"`,
          describe: (o) => ({ outputSummary: `${o.results.length} web results (WEB_FOUND at most)`, evidenceAdded: o.results.length }),
        });
        if (r.ok) state.web = r.out;
      }
      return finish("done", "online_path");
    }

    // 5. Local discovery.
    if (!state.places) {
      if (used >= maxSteps) return finish("stopped", "step_limit");
      const category = id.category === "unknown" || id.category === "uncategorised" ? undefined : id.category;
      const r = await exec("discover_local_places", { product: id.product, category, location: state.location!, radiusMeters: state.radiusMeters }, {
        decision: state.widened ? `Nothing relevant within 5 km, so widen once to ${WIDER_RADIUS_M / 1000} km.` : "Find stores of the right type near the user. This does not prove stock.",
        inputSummary: `${id.product} near ${clip(state.location!, 40)} (${state.radiusMeters / 1000} km)`,
        describe: (o) => ({ outputSummary: `${o.places.length} places${o.places.length ? `: ${o.places.slice(0, 3).map((p) => p.name).join(", ")}` : ""}`, evidenceAdded: o.places.length }),
      });
      if (!r.ok) {
        if (r.err.code === "GEOCODE_FAILED") {
          state.location = undefined;
          return ask("location", "I couldn't find that place. Which city or area should I search near?", "needs_location");
        }
        const why = r.err.code === "NOT_CONFIGURED" ? "Local store lookup isn't set up on this server yet." : r.err.code === "UPSTREAM_UNAVAILABLE" ? "The places data is unavailable right now." : r.err.message;
        return finish("stopped", "tool_error", { note: why });
      }
      state.places = r.out.places;
      continue;
    }
    if (state.places.length === 0) {
      if (!state.widened && state.radiusMeters < WIDER_RADIUS_M) {
        state.widened = true;
        state.radiusMeters = WIDER_RADIUS_M;
        state.places = undefined;
        continue;
      }
      return finish("done", "no_places");
    }

    // 6. Gather evidence only as far as it helps, within the step budget.
    const places = state.places;
    const top = places[0]!;
    const remaining = maxSteps - used;
    const failed = new Set(state.failed);
    const markFailed = (key: string) => {
      failed.add(key);
      if (!state.failed.includes(key)) state.failed.push(key);
    };
    const mainKey = (placeId: string) => `main:${placeId}`;
    const altKey = (product: string) => `alt:${product}@${top.id}`;

    const alternatives = id.alternatives.slice(0, MAX_ALTERNATIVES);
    const wantCompare = alternatives.length > 0 && (id.confidence < COMPARE_BELOW_CONFIDENCE || Boolean(state.requirements));
    const altPending = wantCompare ? alternatives.filter((a) => !state.altChecks[altKey(a)] && !failed.has(altKey(a))) : [];
    const comparePending = wantCompare && !state.comparison && !failed.has("compare") ? 1 : 0;
    const tailPending = (state.details || failed.has("details") ? 0 : 1) + (state.directions || failed.has("directions") ? 0 : 1);
    const firstCheckPending = state.checks[top.id] || failed.has(mainKey(top.id)) ? 0 : 1;
    // Compare only if its whole group fits alongside the minimum useful run.
    const doCompare = wantCompare && remaining >= firstCheckPending + tailPending + altPending.length + comparePending;
    const hasConfirmed = Object.values(state.checks).some((c) => c.status === "CONFIRMED");

    const checkMain = async (placeId: string, decision: string) => {
      const p = places.find((x) => x.id === placeId)!;
      const r = await exec("check_local_inventory", { storeId: p.id, product: id.product }, {
        decision,
        inputSummary: `${p.name}, ${id.product}`,
        describe: (o) => ({ outputSummary: `${o.status} (${o.confidence})`, evidenceAdded: o.evidence.length }),
      });
      if (r.ok) state.checks[p.id] = r.out;
      else markFailed(mainKey(p.id));
    };

    // Evidence for the best-fitting store comes first. With almost no budget, details beat a check.
    if (firstCheckPending && remaining - 1 >= Math.min(tailPending, 1)) {
      await checkMain(top.id, "Check evidence at the best-fitting store; being the right kind of store is not stock evidence.");
      continue;
    }
    if (doCompare && altPending.length > 0) {
      const alt = altPending[0]!;
      const r = await exec("check_local_inventory", { storeId: top.id, product: alt }, {
        decision: "Confidence is moderate, so check an alternative at the same store to make the comparison meaningful.",
        inputSummary: `${top.name}, ${alt}`,
        describe: (o) => ({ outputSummary: `${o.status} (${o.confidence})`, evidenceAdded: o.evidence.length }),
      });
      if (r.ok) state.altChecks[altKey(alt)] = r.out;
      else markFailed(altKey(alt));
      continue;
    }
    const nextMain = places.find((p) => !state.checks[p.id] && !failed.has(mainKey(p.id)));
    const mainChecked = places.filter((p) => state.checks[p.id]).length;
    if (!hasConfirmed && nextMain && mainChecked < MAX_MAIN_CHECKS && remaining - 1 >= tailPending + (doCompare ? comparePending : 0)) {
      await checkMain(nextMain.id, "No confirmed stock yet, so check the next-best store.");
      continue;
    }
    if (doCompare && comparePending) {
      const products = [id.product, ...alternatives];
      const r = await exec("compare_products", { products, location: state.location, userRequirements: state.requirements }, {
        decision: "Alternatives exist and confidence is moderate, so compare them using the evidence gathered.",
        inputSummary: products.join(" vs "),
        describe: (o) => ({ outputSummary: clip(o.recommendation, 90), provider: providerLabel(o.meta) }),
      });
      if (r.ok) state.comparison = r.out;
      else markFailed("compare");
      continue;
    }

    // 7. Act: details and directions for the best place.
    const best = pickBest(state)!;
    if (!state.details && remaining >= 1) {
      const r = await exec("get_place_details", { placeId: best.id }, {
        decision: "Fetch address and contact details for the best option.", inputSummary: best.name,
        describe: (o) => ({ outputSummary: `${o.name}${o.phone ? ", phone listed" : ", no phone listed"}`, evidenceAdded: o.evidence.length }),
      });
      if (r.ok) state.details = r.out;
      else markFailed("details");
      continue;
    }
    if (!state.directions && remaining >= 1) {
      const r = await exec("get_directions", { placeId: best.id, origin: state.location }, {
        decision: "Give the user an action: a route to the best option.", inputSummary: best.name,
        describe: (o) => ({ outputSummary: `link to ${clip(o.destination, 50)}` }),
      });
      if (r.ok) state.directions = r.out;
      else markFailed("directions");
      continue;
    }
    const unfinished = (!state.details && !failed.has("details")) || (!state.directions && !failed.has("directions"));
    return unfinished ? finish("stopped", "step_limit") : finish("done", "complete");
  }
}
