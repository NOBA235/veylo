import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import type {
  IdentifyAssist,
  IdentifyAssistRequest,
  IdentifyAssistResult,
  CompareAssist,
  CompareAssistRequest,
  CompareAssistResult,
} from "../types";
import { IdentifyAssistResultSchema, CompareAssistResultSchema } from "../types";
import { buildIdentifyPrompt, buildComparePrompt, extractJsonFromText } from "../util";

export const DEFAULT_BEDROCK_MODEL_ID = "us.amazon.nova-pro-v1:0";

export interface BedrockProviderOptions {
  region?: string;
  modelId?: string;
  maxTokens?: number;
  /** Inject a client (tests). When omitted, the AWS SDK default credential chain is used. */
  client?: Pick<BedrockRuntimeClient, "send">;
}

/**
 * Amazon Bedrock assist (Converse API).
 *
 * Honesty contract: this class either returns a result produced by a live Bedrock
 * ConverseCommand, or throws. It never substitutes another model or a template.
 * The core catches the error, uses the deterministic rules result, and records
 * `meta.fallbackFrom = "bedrock"` so the trace shows exactly what happened.
 *
 * Credentials come from the standard AWS SDK chain: env vars, AWS_PROFILE / SSO,
 * or an attached IAM role (ECS, EC2, App Runner, Lambda).
 */
class BedrockConverse {
  readonly provider = "bedrock" as const;
  readonly modelId: string;
  private readonly client: Pick<BedrockRuntimeClient, "send">;
  private readonly maxTokens: number;

  constructor(options: BedrockProviderOptions = {}) {
    this.modelId = options.modelId ?? process.env.BEDROCK_MODEL_ID ?? DEFAULT_BEDROCK_MODEL_ID;
    this.maxTokens = options.maxTokens ?? Number(process.env.BEDROCK_MAX_TOKENS || "1024");
    this.client =
      options.client ??
      new BedrockRuntimeClient({
        region: options.region ?? process.env.AWS_REGION ?? "us-east-1",
        maxAttempts: 3,
        retryMode: "adaptive",
      });
  }

  protected async converse(system: string, user: string): Promise<string> {
    const response = await this.client.send(
      new ConverseCommand({
        modelId: this.modelId,
        system: [{ text: system }],
        messages: [{ role: "user", content: [{ text: user }] }],
        inferenceConfig: { maxTokens: this.maxTokens, temperature: 0.2 },
      }),
    );
    const text = response.output?.message?.content?.find((c) => typeof c.text === "string")?.text;
    if (!text) throw new Error(`Bedrock (${this.modelId}) returned no text content`);
    return text;
  }
}

export class BedrockIdentifyAssist extends BedrockConverse implements IdentifyAssist {
  async identify(req: IdentifyAssistRequest): Promise<IdentifyAssistResult> {
    const { system, user } = buildIdentifyPrompt(req);
    return extractJsonFromText(await this.converse(system, user), IdentifyAssistResultSchema);
  }
}

export class BedrockCompareAssist extends BedrockConverse implements CompareAssist {
  async compare(req: CompareAssistRequest): Promise<CompareAssistResult> {
    const { system, user } = buildComparePrompt(req);
    return extractJsonFromText(await this.converse(system, user), CompareAssistResultSchema);
  }
}
