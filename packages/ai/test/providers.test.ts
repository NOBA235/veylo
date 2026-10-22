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
  DEFAULT_BEDROCK_MODEL_ID,
} from "../src/index";

const silent = { info() {}, warn() {} };

/** Minimal stand-in for BedrockRuntimeClient.send that records the command it received. */
function fakeClient(reply: string | Error) {
  const sent: unknown[] = [];
  return {
    sent,
    client: {
      send: async (cmd: unknown) => {
        sent.push(cmd);
        if (reply instanceof Error) throw reply;
        return { output: { message: { role: "assistant", content: [{ text: reply }] } } };
      },
    } as never,
  };
}

test("resolveProviderName accepts bedrock and rules only; anything else means rules", () => {
  assert.equal(resolveProviderName("rules"), "rules");
  assert.equal(resolveProviderName("bedrock"), "bedrock");
  assert.equal(resolveProviderName("BEDROCK"), "bedrock");
  assert.equal(resolveProviderName("unsupported"), "rules");
  assert.equal(resolveProviderName("unknown"), "rules");
  assert.equal(resolveProviderName(undefined), "rules");
  assert.equal(resolveProviderName(""), "rules");
});

test("createAiAssists defaults to rules provider with no AWS account needed", () => {
  const assists = createAiAssists({ provider: "rules", logger: silent });
  assert.equal(assists.provider, "rules");
  assert.equal(assists.identifyAssist, undefined);
  assert.equal(assists.compareAssist, undefined);
});

test("createAiAssists builds Bedrock assists when requested", () => {
  const assists = createAiAssists({ provider: "bedrock", logger: silent });
  assert.equal(assists.provider, "bedrock");
  assert.ok(assists.identifyAssist instanceof BedrockIdentifyAssist);
  assert.ok(assists.compareAssist instanceof BedrockCompareAssist);
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
    notes: [{ product: "USB-C to HDMI adapter", pros: ["Compact"] }],
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

test("Bedrock assists use the configured model, defaulting to Amazon Nova Pro", () => {
  const saved = process.env.BEDROCK_MODEL_ID;
  delete process.env.BEDROCK_MODEL_ID;
  try {
    assert.equal(new BedrockIdentifyAssist({ client: fakeClient("{}").client }).modelId, DEFAULT_BEDROCK_MODEL_ID);
    assert.equal(new BedrockCompareAssist({ modelId: "custom-model", client: fakeClient("{}").client }).modelId, "custom-model");
  } finally {
    if (saved !== undefined) process.env.BEDROCK_MODEL_ID = saved;
  }
});

test("BedrockIdentifyAssist parses a real Converse reply into the identify schema", async () => {
  const fake = fakeClient(
    '```json\n{"product":"PTFE tape","category":"plumbing consumables","confidence":0.92,"reasoning":"white tape for pipe threads","alternatives":["Pipe thread sealant"]}\n```',
  );
  const assist = new BedrockIdentifyAssist({ modelId: "test-model", client: fake.client });
  const res = await assist.identify({
    description: "the white tape plumbers use around pipe threads",
    shortlist: [{ name: "PTFE tape", category: "plumbing consumables", description: "thread seal tape", score: 0.9 }],
    categories: ["plumbing consumables"],
  });
  assert.equal(res.product, "PTFE tape");
  assert.equal(res.confidence, 0.92);
  assert.deepEqual(res.alternatives, ["Pipe thread sealant"]);
  assert.equal(fake.sent.length, 1);
  const input = (fake.sent[0] as { input: { modelId: string } }).input;
  assert.equal(input.modelId, "test-model");
});

test("Bedrock assists throw instead of inventing output when the call fails", async () => {
  const id = new BedrockIdentifyAssist({ client: fakeClient(new Error("AccessDeniedException")).client });
  await assert.rejects(
    () => id.identify({ description: "x", shortlist: [], categories: [] }),
    /AccessDeniedException/,
  );

  const cmp = new BedrockCompareAssist({ client: fakeClient("sorry, I cannot help with that").client });
  await assert.rejects(() => cmp.compare({ products: [] }), /did not contain a valid JSON object/);
});

test("BedrockCompareAssist parses a real Converse reply into the compare schema", async () => {
  const fake = fakeClient(
    JSON.stringify({
      recommendation: "Standard PTFE tape suits water lines.",
      reasoningSummary: "Gas lines need yellow gas-rated tape.",
      notes: [{ product: "PTFE tape", pros: ["Cheap"], cons: ["Not gas rated"] }],
    }),
  );
  const res = await new BedrockCompareAssist({ client: fake.client }).compare({
    products: [
      {
        name: "PTFE tape",
        category: "plumbing consumables",
        description: "thread seal tape",
        compatibility: [],
        attributes: {},
        availability: "UNKNOWN",
      },
    ],
  });
  assert.equal(res.notes[0]?.product, "PTFE tape");
  assert.deepEqual(res.notes[0]?.cons, ["Not gas rated"]);
});
