import { z } from "zod";
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
  constraints?: {
    location?: string;
    urgency?: string;
    budget?: string;
    compatibility?: string;
  };
  shortlist: ShortlistItem[];
  categories: string[];
}

export const IdentifyAssistResultSchema = z.object({
  product: z.string().min(1),
  category: z.string().default(""),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().default(""),
  alternatives: z.array(z.string()).default([]),
  uncertainty: z.string().default(""),
  clarifyingQuestion: z.string().optional(),
});
export type IdentifyAssistResult = z.output<typeof IdentifyAssistResultSchema>;

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
  availability: InventoryStatus;
  distanceMeters?: number;
}

export interface CompareAssistRequest {
  products: CompareFact[];
  requirements?: Record<string, unknown>;
  location?: string;
}

export const CompareAssistResultSchema = z.object({
  recommendation: z.string().min(1),
  reasoningSummary: z.string().min(1),
  notes: z
    .array(
      z.object({
        product: z.string(),
        pros: z.array(z.string()).default([]),
        cons: z.array(z.string()).default([]),
      })
    )
    .default([]),
});
export type CompareAssistResult = z.output<typeof CompareAssistResultSchema>;

export interface CompareAssist {
  readonly provider: AiProviderName;
  readonly modelId?: string;
  compare(req: CompareAssistRequest): Promise<CompareAssistResult>;
}

export interface AiAssists {
  provider: AiProviderName;
  identifyAssist?: IdentifyAssist;
  compareAssist?: CompareAssist;
}
