import { AiProviderName } from "@veylo/types";
import type { AiAssists } from "./types";
import { BedrockIdentifyAssist, BedrockCompareAssist } from "./providers/bedrock";
import { createRulesAssists } from "./providers/rules";

export * from "./types";
export * from "./util";
export * from "./providers/bedrock";
export * from "./providers/rules";

/** Resolve AI_PROVIDER; unknown or missing values mean `rules`, which needs no AWS account. */
export function resolveProviderName(
  raw: string | undefined = process.env.AI_PROVIDER
): AiProviderName {
  const parsed = AiProviderName.safeParse(raw?.trim().toLowerCase());
  return parsed.success ? parsed.data : "rules";
}

export interface CreateAiAssistsOptions {
  provider?: string;
  logger?: {
    info: (msg: string, meta?: Record<string, unknown>) => void;
    warn: (msg: string, meta?: Record<string, unknown>) => void;
  };
}

/**
 * Creates the configured AI assists.
 *
 * - `rules`: deterministic catalogue ranking, no network.
 * - `bedrock`: Amazon Bedrock Converse. If a call fails (no credentials, no model
 *   access, throttling), the core falls back to rules for that call and labels the
 *   result `rules (fallback from bedrock: <reason>)`. Nothing is relabelled.
 */
export function createAiAssists(options: CreateAiAssistsOptions = {}): AiAssists {
  const providerName = resolveProviderName(options.provider ?? process.env.AI_PROVIDER);
  const logger = options.logger ?? console;

  if (providerName === "bedrock") {
    const identifyAssist = new BedrockIdentifyAssist();
    const compareAssist = new BedrockCompareAssist();
    logger.info(
      `Amazon Bedrock provider enabled (model ${identifyAssist.modelId}, region ${process.env.AWS_REGION ?? "us-east-1"}). Credentials resolve via the AWS SDK default chain.`
    );
    return { provider: "bedrock", identifyAssist, compareAssist };
  }

  return createRulesAssists();
}
