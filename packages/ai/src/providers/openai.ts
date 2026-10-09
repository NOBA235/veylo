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

export interface OpenAiProviderOptions {
  apiKey?: string;
  modelId?: string;
}

export class OpenAiIdentifyAssist implements IdentifyAssist {
  readonly provider = "openai" as const;
  readonly modelId: string;
  private readonly apiKey: string;

  constructor(options: OpenAiProviderOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.OPENAI_API_KEY ?? "";
    this.modelId = options.modelId ?? process.env.OPENAI_MODEL_ID ?? "gpt-4o-mini";
    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
  }

  async identify(req: IdentifyAssistRequest): Promise<IdentifyAssistResult> {
    const { system, user } = buildIdentifyPrompt(req);
    const url = "https://api.openai.com/v1/chat/completions";

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.modelId,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI API error (${res.status}): ${errText.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const outputText = data.choices?.[0]?.message?.content;
    if (!outputText) {
      throw new Error(`OpenAI (${this.modelId}) returned an empty choice`);
    }

    return extractJsonFromText(outputText, IdentifyAssistResultSchema);
  }
}

export class OpenAiCompareAssist implements CompareAssist {
  readonly provider = "openai" as const;
  readonly modelId: string;
  private readonly apiKey: string;

  constructor(options: OpenAiProviderOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.OPENAI_API_KEY ?? "";
    this.modelId = options.modelId ?? process.env.OPENAI_MODEL_ID ?? "gpt-4o-mini";
    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
  }

  async compare(req: CompareAssistRequest): Promise<CompareAssistResult> {
    const { system, user } = buildComparePrompt(req);
    const url = "https://api.openai.com/v1/chat/completions";

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.modelId,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI API error (${res.status}): ${errText.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const outputText = data.choices?.[0]?.message?.content;
    if (!outputText) {
      throw new Error(`OpenAI (${this.modelId}) returned an empty choice`);
    }

    return extractJsonFromText(outputText, CompareAssistResultSchema);
  }
}
