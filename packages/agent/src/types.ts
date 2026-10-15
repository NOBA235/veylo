import type {
  CheckLocalInventoryOutput, CompareProductsOutput, DiscoverLocalPlacesOutput, GetDirectionsOutput,
  GetPlaceDetailsOutput, IdentifyProductOutput, SearchWebOutput, ToolName, Urgency,
} from "@veylo/types";

/** What the caller knows this turn. Later turns pass the previous `state` back in. */
export interface AgentInput {
  /** First turn: what the user said. */
  message?: string;
  /** A reply to a product clarification question. */
  answer?: string;
  /** Optional user identifier for personalized hardware memory. */
  userId?: string;
  location?: string;
  urgency?: Urgency;
  compatibility?: string;
  budget?: string;
  /** Understood keys: compatibility, extraPorts, urgency (see compare_products). */
  requirements?: Record<string, unknown>;
  radiusMeters?: number;
}

/** One inspectable step. Decisions are short statements of why, never private reasoning. */
export interface TraceStep {
  step: number;
  kind: "tool" | "ask" | "stop";
  tool?: ToolName;
  inputSummary?: string;
  outputSummary?: string;
  evidenceAdded?: number;
  confidenceChange?: { from?: number; to: number };
  /** Which AI provider produced the result, including a visible fallback. */
  provider?: string;
  decision: string;
  question?: string;
  error?: { code: string; message: string };
}

/** Fully JSON-serialisable, so a UI or an Alexa+ session can hold it between turns. */
export interface AgentState {
  description: string;
  answers: string[];
  userId?: string;
  userContext?: {
    devices: Array<{
      id: string;
      userId: string;
      deviceType: string;
      brand: string;
      model: string;
      connector: string;
      notes?: string;
    }>;
    inventory: Array<{
      id: string;
      userId: string;
      productId: string;
      acquiredAt: string;
      notes?: string;
      source: string;
    }>;
  };
  ownedWarning?: string;
  location?: string;
  urgency?: Urgency;
  compatibility?: string;
  budget?: string;
  requirements?: Record<string, unknown>;
  radiusMeters: number;
  widened: boolean;
  identified?: IdentifyProductOutput;
  places?: DiscoverLocalPlacesOutput["places"];
  checks: Record<string, CheckLocalInventoryOutput>;
  altChecks: Record<string, CheckLocalInventoryOutput>;
  comparison?: CompareProductsOutput;
  details?: GetPlaceDetailsOutput;
  directions?: GetDirectionsOutput;
  web?: SearchWebOutput;
  webTried?: boolean;
  /** Calls that errored (e.g. "main:<placeId>", "compare"). Never retried, so a failure cannot cause a loop. */
  failed: string[];
  trace: TraceStep[];
}

export type StopReason =
  | "needs_product_detail"
  | "needs_urgency"
  | "needs_location"
  | "complete"
  | "online_path"
  | "no_places"
  | "step_limit"
  | "tool_error";

export interface AgentResult {
  status: "needs_input" | "done" | "stopped";
  stopReason: StopReason;
  question?: { field: "product" | "urgency" | "location"; text: string };
  /** Plain-language summary of what is known, worded so it never overstates stock. */
  answer: string;
  best?: { placeId: string; name: string; status: string; nextAction: string; directionsUrl?: string };
  trace: TraceStep[];
  state: AgentState;
  stepsUsed: number;
}
