# AWS Builder Mini Challenge Integration

> **Mini Challenge Target:** AWS Builder Mini Challenge  
> **Primary Track:** Alexa+  
> **AWS Service Utilized:** Amazon Bedrock (`@aws-sdk/client-bedrock-runtime`)  
> **Implementation Code:** [`packages/ai/src/providers/bedrock.ts`](file:///c:/Users/User/Downloads/veylo-alexa/veylo/packages/ai/src/providers/bedrock.ts)  

---

## 1. Executive Summary

Veylo enters the **AWS Builder Mini Challenge** by integrating **Amazon Bedrock** as a first-class, production-grade intelligence layer.

In Veylo's **UNKNOWN → ACTION** pipeline, ambiguous human requests (e.g. *"I need that little thing that lets me connect my laptop to a TV"*) are transformed into structured product hypotheses and multi-product trade-off evaluations. Amazon Bedrock executes this core semantic reasoning, returning strictly validated JSON objects that feed directly into Veylo's Model Context Protocol (MCP) tool contracts.

```text
Ambiguous Speech / Text
       │
       ▼
[Amazon Bedrock (Claude 3.5 Sonnet / Nova)]
  ├─ ConverseCommand with explicit maxTokens
  └─ Zod-validated structured output
       │
       ├─────────────────────────────────┐
       ▼                                 ▼
identify_product                  compare_products
       │                                 │
       ▼                                 ▼
Physical Store Discovery          Pros / Cons Matrix & Recommendation
(OSM / Overpass / Evidence)
```

---

## 2. Architectural Design & Non-Negotiables

### 2.1 Provider-Agnostic Abstraction with Zero-Broken-Demo Guarantee
Veylo implements a clean provider abstraction supporting `AI_PROVIDER=bedrock|gemini|openai|rules`.

- **Hard Non-Negotiable:** Amazon Bedrock is **never mandatory** for the application to function.
- **Graceful Fallback:** If `AWS_ACCESS_KEY_ID` or credentials are unset or invalid, or if Bedrock encounters rate limits or network failures, Veylo logs a clear warning and seamlessly falls back to the deterministic, zero-dependency `rules` provider. The Alexa+ voice agent and Web UI never crash.

### 2.2 Strict Separation of Semantic Reasoning vs. Physical Inventory
Veylo enforces strict honesty:
- **Bedrock's Role:** Semantic understanding (product hypothesis, aliases, trade-off attributes, pros/cons, clarifying questions).
- **Physical Stores & Inventory:** Gated by OpenStreetMap / Overpass and verified evidence ledgers with explicit trust states (`CONFIRMED`, `LIKELY`, `WEB_FOUND`, `UNKNOWN`). Bedrock is never allowed to fabricate store hours, prices, or shelf availability.

---

## 3. Bedrock Runtime Implementation Details

The implementation is located in [`packages/ai/src/providers/bedrock.ts`](file:///c:/Users/User/Downloads/veylo-alexa/veylo/packages/ai/src/providers/bedrock.ts).

### 3.1 Modern Unified `ConverseCommand` API
Rather than legacy model-specific `InvokeModel` payloads, Veylo uses the AWS Bedrock unified `ConverseCommand`. This enables:
- Cross-model portability across Anthropic Claude 3.5 Sonnet, Claude 3 Haiku, Amazon Nova Pro, Meta Llama 3, and Mistral without rewriting request or response parsing logic.
- Standardized system prompts and message structures.
- Uniform latency and usage metadata collection.

```typescript
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

const command = new ConverseCommand({
  modelId: this.modelId,
  system: [{ text: "You are a specialized product identification AI..." }],
  messages: [{ role: "user", content: [{ text: prompt }] }],
  inferenceConfig: {
    maxTokens: this.maxTokens, // e.g. 1024
    temperature: 0.1,         // low temperature for deterministic structured outputs
  },
});

const response = await this.client.send(command);
```

### 3.2 Explicit `maxTokens` Management
AWS Bedrock throttles requests when models attempt unbounded generation. Veylo explicitly sets `maxTokens: 1024` (configurable via `BEDROCK_MAX_TOKENS`), guaranteeing:
1. Ultra-fast time-to-first-token (critical for Alexa+ voice response latencies < 1.5s).
2. Protection against run-away token billing.

### 3.3 Cross-Region Inference Profiles
Veylo defaults to cross-region inference profiles (`us.anthropic.claude-sonnet-4-6` or `us.anthropic.claude-3-5-haiku-20241022-v1:0`), ensuring resilience against single-region AWS capacity limits during peak hackathon evaluation.

### 3.4 Robust Markdown Stripping & Zod Validation
Bedrock responses are processed by [`extractJsonFromText`](file:///c:/Users/User/Downloads/veylo-alexa/veylo/packages/ai/src/util.ts#L8-L30):
- Automatically strips ````json ... ```` code blocks, reasoning commentary, and trailing tokens.
- Validates the resulting JSON against strict Zod schemas (`IdentifyAssistResultSchema`, `CompareAssistResultSchema`).
- Provides type-safe defaults for missing fields to avoid breaking downstream MCP handlers.

---

## 4. MCP Tools Powered by Bedrock

| MCP Tool | Bedrock Function | Output Provided |
| --- | --- | --- |
| [`identify_product`](file:///c:/Users/User/Downloads/veylo-alexa/veylo/packages/types/src/tools.ts#L6-L23) | `BedrockIdentifyAssist.identify()` | Canonical product name, category, confidence score (0.0-1.0), reasoning summary, alternative hypotheses, aliases, uncertainty notes, and targeted clarifying questions. |
| [`compare_products`](file:///c:/Users/User/Downloads/veylo-alexa/veylo/packages/types/src/tools.ts#L61-L75) | `BedrockCompareAssist.compare()` | Comparative trade-off attributes, pros/cons per candidate, canonical recommendation, and objective reasoning summary. |

---

## 5. Configuration & Setup

### 5.1 Environment Variables (`.env`)

```bash
# Enable Bedrock as the primary AI engine
AI_PROVIDER=bedrock

# AWS Credentials and Region
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

# Optional: temporary session token if using AWS IAM Identity Center / STS
# AWS_SESSION_TOKEN=

# Model ID or Cross-Region Inference Profile
BEDROCK_MODEL_ID=us.anthropic.claude-sonnet-4-6

# Max tokens budget (default: 1024)
BEDROCK_MAX_TOKENS=1024
```

### 5.2 IAM Policy Requirements
The IAM principal executing Veylo requires only the minimal Bedrock invocation permission:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:Converse"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## 6. Verification and Testing

Veylo includes dedicated automated tests for the Amazon Bedrock integration:

```bash
# Run the AI provider test suite
pnpm --filter @veylo/ai test
```

### Test Coverage:
- `resolveProviderName` parses `bedrock` and defaults to `rules` when unconfigured.
- `createAiAssists` checks credentials and safely falls back to rules if AWS keys are omitted.
- Zod schema validation correctly normalizes Bedrock structured payloads.
- JSON extractor reliably unpacks JSON objects enveloped in conversational responses or markdown fences.
- Bedrock client initialization asserts region, model ID, and explicit token limits.

---

## 7. AWS Builder Judging Checklist

| Requirement | Veylo Implementation | Evidence Link |
| --- | --- | --- |
| **Real AWS Service Used** | Amazon Bedrock (`@aws-sdk/client-bedrock-runtime`) | [`packages/ai/src/providers/bedrock.ts`](file:///c:/Users/User/Downloads/veylo-alexa/veylo/packages/ai/src/providers/bedrock.ts) |
| **Load-Bearing Architecture** | Powers `identify_product` and `compare_products` MCP tools | [`apps/mcp-server/src/context.ts`](file:///c:/Users/User/Downloads/veylo-alexa/veylo/apps/mcp-server/src/context.ts) |
| **Modern AWS APIs** | AWS Bedrock `ConverseCommand` API with cross-region profiles | [`packages/ai/src/providers/bedrock.ts`](file:///c:/Users/User/Downloads/veylo-alexa/veylo/packages/ai/src/providers/bedrock.ts#L45-L68) |
| **Documented Integration** | Comprehensive technical documentation and `.env.example` | [`docs/aws-builder-integration.md`](file:///c:/Users/User/Downloads/veylo-alexa/veylo/docs/aws-builder-integration.md), [`.env.example`](file:///c:/Users/User/Downloads/veylo-alexa/veylo/.env.example) |
| **Zero-Billing Resilience** | Graceful fallback to offline deterministic rules | [`packages/ai/src/index.ts`](file:///c:/Users/User/Downloads/veylo-alexa/veylo/packages/ai/src/index.ts#L43-L68) |
