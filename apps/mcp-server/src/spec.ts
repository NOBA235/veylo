// SDK-independent statement of which MCP spec revision Veylo targets.
export const REQUIRED_PROTOCOL_VERSION = "2025-11-25";
export const SERVER_NAME = "veylo";
export const SERVER_VERSION = "0.1.0";

/**
 * Fail fast if the installed MCP SDK cannot speak the spec revision Veylo documents.
 * (The SDK negotiates protocol versions itself; this guards against an SDK that is too old.)
 */
export function assertSpecSupport(supported: readonly string[]): void {
  if (!supported.includes(REQUIRED_PROTOCOL_VERSION)) {
    throw new Error(
      `The installed @modelcontextprotocol/sdk supports [${supported.join(", ")}] but Veylo targets MCP ${REQUIRED_PROTOCOL_VERSION}. Upgrade the SDK.`,
    );
  }
}

/** Shown to connecting agents (MCP `instructions`). Encodes Veylo's honesty rules for the caller. */
export const SERVER_INSTRUCTIONS = [
  "Veylo turns a vague description of a physical product into a likely product and nearby places to look for it.",
  "Start with identify_product. If it returns clarifyingQuestion, ask the user that question instead of guessing.",
  "Inventory states are literal: only CONFIRMED means current stock. LIKELY, WEB_FOUND and UNKNOWN mean stock is NOT confirmed; never tell the user a store has the product unless the state is CONFIRMED.",
  "Prices, opening hours and contact details are only present when a source provided them; do not invent them.",
  "Use check_local_inventory per store (not all at once) and stop when you have enough to recommend an action.",
].join(" ");
