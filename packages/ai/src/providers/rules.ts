import type { AiAssists } from "../types";

/**
 * Rules provider: represents the deterministic, rules-based engine.
 * Requires no external API keys or credentials.
 * When active, CoreContext's identifyAssist and compareAssist remain undefined,
 * allowing Veylo's exact aliases, trigram matching, and catalogue logic to run natively.
 */
export function createRulesAssists(): AiAssists {
  return {
    provider: "rules",
    identifyAssist: undefined,
    compareAssist: undefined,
  };
}

