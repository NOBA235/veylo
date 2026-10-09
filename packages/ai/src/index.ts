import { AiProviderName } from "@veylo/types";
import type { AiAssists } from "./types";
import { BedrockIdentifyAssist, BedrockCompareAssist } from "./providers/bedrock";
import { GeminiIdentifyAssist, GeminiCompareAssist } from "./providers/gemini";
import { OpenAiIdentifyAssist, OpenAiCompareAssist } from "./providers/openai";
import { createRulesAssists } from "./providers/rules";

export * from "./types";
export * from "./util";
export * from "./providers/bedrock";
export * from "./providers/gemini";
export * from "./providers/openai";
export * from "./providers/rules";

/** Resolve AI_PROVIDER; unknown or missing values mean `rules`, which needs no keys. */
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
 * Creates the configured AI assists with automatic fallback to rules.
 * Never throws if credentials are missing or invalid: always falls back safely.
 */
export function createAiAssists(options: CreateAiAssistsOptions = {}): AiAssists {
  const providerName = resolveProviderName(options.provider ?? process.env.AI_PROVIDER);
  const logger = options.logger ?? console;

  if (providerName === "rules") {
    return createRulesAssists();
  }

  if (providerName === "bedrock") {
    try {
      const hasKeys = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
      if (!hasKeys && !process.env.AWS_PROFILE) {
        logger.warn(
          "AI_PROVIDER=bedrock is requested, but AWS credentials are not set. Falling back to rules provider."
        );
        return createRulesAssists();
      }

      const identifyAssist = new BedrockIdentifyAssist();
      const compareAssist = new BedrockCompareAssist();
      logger.info(`Initialized Amazon Bedrock AI provider with model ${identifyAssist.modelId}`);

      return {
        provider: "bedrock",
        identifyAssist,
        compareAssist,
      };
    } catch (err) {
      logger.warn(
        `Failed to initialize Amazon Bedrock provider: ${String(err)}. Falling back to rules provider.`
      );
      return createRulesAssists();
    }
  }

  if (providerName === "gemini") {
    try {
      if (!process.env.GEMINI_API_KEY) {
        logger.warn(
          "AI_PROVIDER=gemini is requested, but GEMINI_API_KEY is not set. Falling back to rules provider."
        );
        return createRulesAssists();
      }

      const identifyAssist = new GeminiIdentifyAssist();
      const compareAssist = new GeminiCompareAssist();
      logger.info(`Initialized Google Gemini AI provider with model ${identifyAssist.modelId}`);

      return {
        provider: "gemini",
        identifyAssist,
        compareAssist,
      };
    } catch (err) {
      logger.warn(
        `Failed to initialize Gemini provider: ${String(err)}. Falling back to rules provider.`
      );
      return createRulesAssists();
    }
  }

  if (providerName === "openai") {
    try {
      if (!process.env.OPENAI_API_KEY) {
        logger.warn(
          "AI_PROVIDER=openai is requested, but OPENAI_API_KEY is not set. Falling back to rules provider."
        );
        return createRulesAssists();
      }

      const identifyAssist = new OpenAiIdentifyAssist();
      const compareAssist = new OpenAiCompareAssist();
      logger.info(`Initialized OpenAI provider with model ${identifyAssist.modelId}`);

      return {
        provider: "openai",
        identifyAssist,
        compareAssist,
      };
    } catch (err) {
      logger.warn(
        `Failed to initialize OpenAI provider: ${String(err)}. Falling back to rules provider.`
      );
      return createRulesAssists();
    }
  }

  return createRulesAssists();
}
