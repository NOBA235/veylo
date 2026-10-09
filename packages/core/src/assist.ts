// Ports for AI providers. Phase 5/6 implements these for Bedrock, Gemini, OpenAI.
// The core never trusts an assist blindly: results are validated and guard-railed (see identify.ts, compare.ts).
import type { AiProviderName, InventoryStatus } from "@veylo/types";

export interface ShortlistItem {
  name: string;
  category: string;
  description: string;
  score: number;
}

export interface IdentifyAssistRequest {
  description: string;
  visualDescription?: string;
  constraints?: { location?: string; urgency?: string; budget?: string; compatibility?: string };
  /** Best catalogue matches from the rules stages; the model should prefer these. */
  shortlist: ShortlistItem[];
  /** Every catalogue category; the model must pick one of these for `category`. */
  categories: string[];
}

export interface IdentifyAssistResult {
  product: string;
  category: string;
  confidence: number;
  reasoning: string;
  alternatives: string[];
  uncertainty: string;
  clarifyingQuestion?: string;
}

export interface IdentifyAssist {
  readonly provider: AiProviderName;
  readonly modelId?: string;
  identify(req: IdentifyAssistRequest): Promise<IdentifyAssistResult>;
}

export interface CompareFact {
  name: string;
  category: string;
  description: string;
  compatibility: string[];
  attributes: Record<string, unknown>;
  /** Ground truth from collected evidence. The model may not change these. */
  availability: InventoryStatus;
  distanceMeters?: number;
}

export interface CompareAssistRequest {
  products: CompareFact[];
  requirements?: Record<string, unknown>;
  location?: string;
}

export interface CompareAssistResult {
  recommendation: string;
  reasoningSummary: string;
  notes: Array<{ product: string; pros: string[]; cons: string[] }>;
}

export interface CompareAssist {
  readonly provider: AiProviderName;
  readonly modelId?: string;
  compare(req: CompareAssistRequest): Promise<CompareAssistResult>;
}
