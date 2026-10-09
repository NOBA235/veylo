import type { InventoryStatus } from "@veylo/types";
import type { AgentState, StopReason } from "./types";

const STATUS_RANK: Record<InventoryStatus, number> = { CONFIRMED: 3, LIKELY: 2, WEB_FOUND: 1, UNKNOWN: 0 };
const STATUS_PHRASE: Record<InventoryStatus, string> = {
  CONFIRMED: "stock confirmed",
  LIKELY: "likely, but not confirmed",
  WEB_FOUND: "mentioned on the web, not confirmed",
  UNKNOWN: "no evidence either way",
};
const pct = (n: number) => `${Math.round(n * 100)}%`;
const km = (m: number | undefined) => (m === undefined ? "" : `, ${(m / 1000).toFixed(1)} km away`);

/** Best checked place: strongest status, then nearest. Falls back to the top-ranked place. */
export function pickBest(state: AgentState) {
  const places = state.places ?? [];
  const checked = places.filter((p) => state.checks[p.id]);
  const pool = checked.length > 0 ? checked : places.slice(0, 1);
  return [...pool].sort(
    (a, b) =>
      STATUS_RANK[state.checks[b.id]?.status ?? "UNKNOWN"] - STATUS_RANK[state.checks[a.id]?.status ?? "UNKNOWN"] ||
      (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity),
  )[0];
}

export function buildAnswer(state: AgentState, reason: StopReason, note?: string): string {
  const id = state.identified;
  const lines: string[] = [];
  if (!id || id.product === "unidentified") {
    lines.push("I couldn't tell what you mean yet.");
  } else {
    lines.push(`You probably mean a ${id.product} (${pct(id.confidence)} confident).`);
    if (id.uncertainty && !/^No significant ambiguity/.test(id.uncertainty)) lines.push(id.uncertainty);
  }
  if (note) lines.push(note);

  if (reason === "online_path") {
    if (state.web && state.web.results.length > 0) {
      lines.push(`Since you'll order online: ${state.web.results.slice(0, 3).map((r) => `${r.title} (${r.url})`).join("; ")}. These pages mention the product; they don't show stock.`);
    } else if (id && id.product !== "unidentified") {
      lines.push(`Since you'll order online, search for "${id.product}" at a retailer you trust. I couldn't look it up on the web from here.`);
    }
    return lines.join(" ");
  }
  if (reason === "no_places") {
    lines.push(`I couldn't find a relevant store within ${state.radiusMeters / 1000} km of ${state.location}. Try a wider area or ordering online.`);
    return lines.join(" ");
  }

  const checked = (state.places ?? []).filter((p) => state.checks[p.id]);
  if (checked.length > 0) {
    lines.push("Nearby options:");
    for (const p of checked) {
      const c = state.checks[p.id]!;
      const detail = c.evidence.find((e) => e.sourceType !== "osm" && e.sourceType !== "api")?.evidenceSummary;
      lines.push(`- ${c.store}${km(p.distanceMeters)}: ${STATUS_PHRASE[c.status]}${c.status === "LIKELY" || c.status === "WEB_FOUND" ? (detail ? ` (${detail.replace(/\.$/, "")})` : "") : ""}.`);
    }
    const unchecked = (state.places ?? []).filter((p) => !state.checks[p.id]).slice(0, 2);
    if (unchecked.length > 0) lines.push(`Also nearby, not checked: ${unchecked.map((p) => p.name).join(", ")}.`);
  }
  if (state.comparison) {
    lines.push(state.comparison.recommendation);
    lines.push("I can't compare prices: there is no verified price source.");
  }
  const best = pickBest(state);
  if (best) {
    const c = state.checks[best.id];
    lines.push(`Best next step: ${c ? c.nextAction : `visit or contact ${best.name}.`}`);
    if (state.directions) lines.push(`Directions: ${state.directions.url}`);
  }
  return lines.join("\n");
}
