import { z } from "zod";

export const AI_PROVIDERS = ["gemini", "openai", "bedrock", "rules"] as const;
export const AiProviderName = z.enum(AI_PROVIDERS);
export type AiProviderName = z.infer<typeof AiProviderName>;

/** Explicit inventory trust states. A business appearing in results never implies stock. */
export const InventoryStatus = z.enum(["CONFIRMED", "LIKELY", "WEB_FOUND", "UNKNOWN"]);
export type InventoryStatus = z.infer<typeof InventoryStatus>;

export const Urgency = z.enum(["today", "this_week", "online", "unknown"]);
export type Urgency = z.infer<typeof Urgency>;

export const Confidence = z.number().min(0).max(1);

export const EvidenceSourceType = z.enum([
  "curated",
  "web",
  "api",
  "osm",
  "store",
  "user",
  "ai_inferred",
]);
export type EvidenceSourceType = z.infer<typeof EvidenceSourceType>;

/** source / source_type / timestamp / confidence / evidence_summary, attached to every important fact. */
export const Evidence = z.object({
  source: z.string().min(1),
  sourceType: EvidenceSourceType,
  timestamp: z.string().datetime(),
  confidence: Confidence,
  evidenceSummary: z.string().min(1),
});
export type Evidence = z.infer<typeof Evidence>;

/** Which AI provider actually produced a result (surfaced in the agent trace). */
export const ProviderMeta = z.object({
  provider: AiProviderName,
  modelId: z.string().optional(),
  latencyMs: z.number().nonnegative().optional(),
  fallbackFrom: AiProviderName.optional(),
  fallbackReason: z.string().optional(),
});
export type ProviderMeta = z.infer<typeof ProviderMeta>;
