import assert from "node:assert/strict";
import { test } from "node:test";
import {
  resolveProviderName,
  createAiAssists,
  extractJsonFromText,
  buildIdentifyPrompt,
  buildComparePrompt,
  IdentifyAssistResultSchema,
  CompareAssistResultSchema,
  BedrockIdentifyAssist,
  BedrockCompareAssist,
} from "../src/index";

test("resolveProviderName resolves valid providers and defaults unknown to rules", () => {
  assert.equal(resolveProviderName("rules"), "rules");
  assert.equal(resolveProviderName("bedrock"), "bedrock");
  assert.equal(resolveProviderName("BEDROCK"), "bedrock");
  assert.equal(resolveProviderName("gemini"), "gemini");
  assert.equal(resolveProviderName("openai"), "openai");
  assert.equal(resolveProviderName(undefined), "rules");
  assert.equal(resolveProviderName(""), "rules");
  assert.equal(resolveProviderName("unknown-model"), "rules");
});

test("createAiAssists defaults to rules provider with no keys needed", () => {
  const assists = createAiAssists({ provider: "rules" });
  assert.equal(assists.provider, "rules");
  assert.equal(assists.identifyAssist, undefined);
  assert.equal(assists.compareAssist, undefined);
});

test("createAiAssists falls back to rules if bedrock credentials are missing", () => {
  const originalKey = process.env.AWS_ACCESS_KEY_ID;
  const originalSecret = process.env.AWS_SECRET_ACCESS_KEY;
  delete process.env.AWS_ACCESS_KEY_ID;
  delete process.env.AWS_SECRET_ACCESS_KEY;

  const warnings: string[] = [];
  const assists = createAiAssists({
    provider: "bedrock",
    logger: { info() {}, warn: (msg) => warnings.push(msg) },
  });

  assert.equal(assists.provider, "rules");
  assert.equal(assists.identifyAssist, undefined);
  assert.ok(warnings.some((w) => w.includes("Falling back to rules")));

  if (originalKey) process.env.AWS_ACCESS_KEY_ID = originalKey;
  if (originalSecret) process.env.AWS_SECRET_ACCESS_KEY = originalSecret;
});

test("createAiAssists falls back to rules if gemini or openai keys are missing", () => {
  const originalGemini = process.env.GEMINI_API_KEY;
  const originalOpenAi = process.env.OPENAI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  const geminiAssists = createAiAssists({ provider: "gemini" });
  assert.equal(geminiAssists.provider, "rules");

  const openaiAssists = createAiAssists({ provider: "openai" });
  assert.equal(openaiAssists.provider, "rules");

  if (originalGemini) process.env.GEMINI_API_KEY = originalGemini;
  if (originalOpenAi) process.env.OPENAI_API_KEY = originalOpenAi;
});

test("extractJsonFromText handles raw JSON, markdown codeblocks, and text wrappers", () => {
  const raw = `{"product":"USB-C to HDMI adapter","category":"video adapters","confidence":0.91,"reasoning":"match"}`;
  const res1 = extractJsonFromText(raw, IdentifyAssistResultSchema);
  assert.equal(res1.product, "USB-C to HDMI adapter");
  assert.equal(res1.confidence, 0.91);
  assert.deepEqual(res1.alternatives, []); // default applied

  const fenced = `Here is the structured result:
\`\`\`json
{
  "product": "PTFE tape",
  "category": "plumbing consumables",
  "confidence": 0.88,
  "reasoning": "white tape for threads",
  "alternatives": ["Thread seal tape"]
}
\`\`\`
Hope this helps!`;
  const res2 = extractJsonFromText(fenced, IdentifyAssistResultSchema);
  assert.equal(res2.product, "PTFE tape");
  assert.equal(res2.category, "plumbing consumables");
  assert.deepEqual(res2.alternatives, ["Thread seal tape"]);

  assert.throws(() => extractJsonFromText("no json here", IdentifyAssistResultSchema), /did not contain a valid JSON object/);
  assert.throws(() => extractJsonFromText(`{"category":"video adapters"}`, IdentifyAssistResultSchema), /failed schema validation/);
});

test("CompareAssistResultSchema validates and applies defaults", () => {
  const json = JSON.stringify({
    recommendation: "USB-C to HDMI adapter is best",
    reasoningSummary: "Confirmed nearby stock",
    notes: [
      { product: "USB-C to HDMI adapter", pros: ["Compact"] },
    ],
  });
  const res = extractJsonFromText(json, CompareAssistResultSchema);
  assert.equal(res.recommendation, "USB-C to HDMI adapter is best");
  assert.deepEqual(res.notes[0]?.cons, []); // default applied
});

test("prompt builders construct expected structured schemas", () => {
  const idPrompt = buildIdentifyPrompt({
    description: "connect laptop to TV",
    shortlist: [{ name: "USB-C to HDMI adapter", category: "video adapters", description: "test", score: 0.9 }],
    categories: ["video adapters", "audio adapters"],
  });
  assert.ok(idPrompt.system.includes("Veylo's Product Identification Engine"));
  assert.ok(idPrompt.user.includes("connect laptop to TV"));
  assert.ok(idPrompt.user.includes("USB-C to HDMI adapter"));

  const cmpPrompt = buildComparePrompt({
    products: [
      {
        name: "USB-C to HDMI adapter",
        category: "video adapters",
        description: "adapter",
        compatibility: ["USB-C"],
        attributes: {},
        availability: "LIKELY",
      },
    ],
  });
  assert.ok(cmpPrompt.system.includes("NEVER fabricate availability"));
  assert.ok(cmpPrompt.user.includes("Current Stock State: LIKELY"));
});

test("Bedrock client initializes with explicit maxTokens and defaults", () => {
  const assist = new BedrockIdentifyAssist({
    region: "us-east-1",
    modelId: "us.anthropic.claude-sonnet-4-6",
    maxTokens: 512,
  });
  assert.equal(assist.provider, "bedrock");
  assert.equal(assist.modelId, "us.anthropic.claude-sonnet-4-6");

  const cmpAssist = new BedrockCompareAssist({
    region: "us-east-1",
  });
  assert.equal(cmpAssist.provider, "bedrock");
  assert.equal(cmpAssist.modelId, "us.anthropic.claude-sonnet-4-6");
});
