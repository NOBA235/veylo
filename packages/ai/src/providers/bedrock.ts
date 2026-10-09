import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import type {
  IdentifyAssist,
  IdentifyAssistRequest,
  IdentifyAssistResult,
  CompareAssist,
  CompareAssistRequest,
  CompareAssistResult,
} from "../types";
import {
  IdentifyAssistResultSchema,
  CompareAssistResultSchema,
} from "../types";
import {
  buildIdentifyPrompt,
  buildComparePrompt,
  extractJsonFromText,
} from "../util";

export interface BedrockProviderOptions {
  region?: string;
  modelId?: string;
  maxTokens?: number;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
}

export class BedrockIdentifyAssist implements IdentifyAssist {
  readonly provider = "bedrock" as const;
  readonly modelId: string;
  private readonly client: BedrockRuntimeClient;
  private readonly maxTokens: number;

  constructor(options: BedrockProviderOptions = {}) {
    const region = options.region ?? process.env.AWS_REGION ?? "us-east-1";
    this.modelId = options.modelId ?? process.env.BEDROCK_MODEL_ID ?? "us.anthropic.claude-sonnet-4-6";
    this.maxTokens = options.maxTokens ?? Number(process.env.BEDROCK_MAX_TOKENS || "1024");

    const accessKeyId = options.accessKeyId ?? process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = options.secretAccessKey ?? process.env.AWS_SECRET_ACCESS_KEY;
    const sessionToken = options.sessionToken ?? process.env.AWS_SESSION_TOKEN;

    this.client = new BedrockRuntimeClient({
      region,
      maxAttempts: 5,
      retryMode: "adaptive",
      ...(accessKeyId && secretAccessKey
        ? {
            credentials: {
              accessKeyId,
              secretAccessKey,
              ...(sessionToken ? { sessionToken } : {}),
            },
          }
        : {}),
    });
  }

  async identify(req: IdentifyAssistRequest): Promise<IdentifyAssistResult> {
    const { system, user } = buildIdentifyPrompt(req);

    const response = await this.client.send(
      new ConverseCommand({
        modelId: this.modelId,
        messages: [
          {
            role: "user",
            content: [{ text: user }],
          },
        ],
        system: [{ text: system }],
        inferenceConfig: {
          maxTokens: this.maxTokens,
          temperature: 0.2,
        },
      })
    );

    const outputText = response.output?.message?.content?.[0]?.text;
    if (!outputText) {
      throw new Error(`Bedrock (${this.modelId}) returned an empty response`);
    }

    return extractJsonFromText(outputText, IdentifyAssistResultSchema);
  }
}

export class BedrockCompareAssist implements CompareAssist {
  readonly provider = "bedrock" as const;
  readonly modelId: string;
  private readonly client: BedrockRuntimeClient;
  private readonly maxTokens: number;

  constructor(options: BedrockProviderOptions = {}) {
    const region = options.region ?? process.env.AWS_REGION ?? "us-east-1";
    this.modelId = options.modelId ?? process.env.BEDROCK_MODEL_ID ?? "us.anthropic.claude-sonnet-4-6";
    this.maxTokens = options.maxTokens ?? Number(process.env.BEDROCK_MAX_TOKENS || "1024");

    const accessKeyId = options.accessKeyId ?? process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = options.secretAccessKey ?? process.env.AWS_SECRET_ACCESS_KEY;
    const sessionToken = options.sessionToken ?? process.env.AWS_SESSION_TOKEN;

    this.client = new BedrockRuntimeClient({
      region,
      maxAttempts: 5,
      retryMode: "adaptive",
      ...(accessKeyId && secretAccessKey
        ? {
            credentials: {
              accessKeyId,
              secretAccessKey,
              ...(sessionToken ? { sessionToken } : {}),
            },
          }
        : {}),
    });
  }

  async compare(req: CompareAssistRequest): Promise<CompareAssistResult> {
    const { system, user } = buildComparePrompt(req);

    const response = await this.client.send(
      new ConverseCommand({
        modelId: this.modelId,
        messages: [
          {
            role: "user",
            content: [{ text: user }],
          },
        ],
        system: [{ text: system }],
        inferenceConfig: {
          maxTokens: this.maxTokens,
          temperature: 0.2,
        },
      })
    );

    const outputText = response.output?.message?.content?.[0]?.text;
    if (!outputText) {
      throw new Error(`Bedrock (${this.modelId}) returned an empty response`);
    }

    return extractJsonFromText(outputText, CompareAssistResultSchema);
  }
}

