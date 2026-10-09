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

export interface GeminiProviderOptions {
  apiKey?: string;
  modelId?: string;
}

export class GeminiIdentifyAssist implements IdentifyAssist {
  readonly provider = "gemini" as const;
  readonly modelId: string;
  private readonly apiKey: string;

  constructor(options: GeminiProviderOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.GEMINI_API_KEY ?? "";
    this.modelId = options.modelId ?? process.env.GEMINI_MODEL_ID ?? "gemini-2.5-flash";
    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }
  }

  async identify(req: IdentifyAssistRequest): Promise<IdentifyAssistResult> {
    const { system, user } = buildIdentifyPrompt(req);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelId}:generateContent?key=${this.apiKey}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${errText.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const outputText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!outputText) {
      throw new Error(`Gemini (${this.modelId}) returned an empty candidate`);
    }

    return extractJsonFromText(outputText, IdentifyAssistResultSchema);
  }
}

export class GeminiCompareAssist implements CompareAssist {
  readonly provider = "gemini" as const;
  readonly modelId: string;
  private readonly apiKey: string;

  constructor(options: GeminiProviderOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.GEMINI_API_KEY ?? "";
    this.modelId = options.modelId ?? process.env.GEMINI_MODEL_ID ?? "gemini-2.5-flash";
    if (!this.apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }
  }

  async compare(req: CompareAssistRequest): Promise<CompareAssistResult> {
    const { system, user } = buildComparePrompt(req);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelId}:generateContent?key=${this.apiKey}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${errText.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const outputText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!outputText) {
      throw new Error(`Gemini (${this.modelId}) returned an empty candidate`);
    }

    return extractJsonFromText(outputText, CompareAssistResultSchema);
  }
}

