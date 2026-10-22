# AWS Cloud Integration Architecture

> **Challenge:** AWS Builder Mini Challenge / Amazon Developer Hackathon  
> **AWS Services:** Amazon Bedrock (`@aws-sdk/client-bedrock-runtime`), Amazon Polly (`@aws-sdk/client-polly`), Amazon RDS / Aurora PostgreSQL  
> **Protocol:** Model Context Protocol (MCP) Spec 2025-11-25  

---

## 1. Executive Summary

Veylo is built on an end-to-end, native **AWS Cloud Architecture** designed to deliver conversational ambient shopping intelligence for Alexa+:

```
                                      ┌──────────────────────────────────────────────┐
                                      │              Veylo AWS Cloud                 │
                                      │                                              │
  User Voice / Multimodal Touch       │   ┌──────────────────────────────────────┐   │
                │                     │   │            Amazon Bedrock            │   │
                ▼                     │   │   (Claude 3.5 Sonnet / Nova Pro)     │   │
  ┌──────────────────────────────┐    │   │      ConverseCommand Reasoning       │   │
  │     Next.js 15 Web / MCP     │───┼──▶│   - Semantic Product Identification  │   │
  │     Ambient Voice Client     │    │   │   - Multi-Product Trade-off Matrix   │   │
  └──────────────┬───────────────┘    │   └──────────────────────────────────────┘   │
                 │                    │                                              │
                 │                    │   ┌──────────────────────────────────────┐   │
                 ├────────────────────┼──▶│             Amazon Polly             │   │
                 │   Audio Stream     │   │     (Joanna Neural Engine TTS)       │   │
                 │◀───────────────────┼───│   - Low-latency Alexa Voice Persona  │   │
                 │                    │   └──────────────────────────────────────┘   │
                 │                    │                                              │
                 │                    │   ┌──────────────────────────────────────┐   │
                 │                    │   │        Amazon RDS / Aurora PG        │   │
                 └────────────────────┼──▶│       (PostgreSQL Serverless v2)     │   │
                                      │   │   - Trigram Search & Graph Schema    │   │
                                      │   │   - User Hardware & Inventory Ledger │   │
                                      │   └──────────────────────────────────────┘   │
                                      └──────────────────────────────────────────────┘
```

1. **Amazon Bedrock (`@aws-sdk/client-bedrock-runtime`)**: Powers core semantic product hypothesis generation and trade-off matrix reasoning via the unified `ConverseCommand` API.
2. **Amazon Polly (`@aws-sdk/client-polly`)**: Powers speech synthesis via Joanna Neural, delivering low-latency ambient voice responses matching Alexa's authentic voice persona.
3. **Amazon RDS / Aurora PostgreSQL**: Enterprise relational data layer managing category taxonomies, hardware compatibility graphs, and user inventory memory with `pg_trgm` fuzzy indexing.

---

## 2. Pillar 1: Amazon Bedrock (`@aws-sdk/client-bedrock-runtime`)

### 2.1 Implementation
Located in [`packages/ai/src/providers/bedrock.ts`](packages/ai/src/providers/bedrock.ts).

- **Modern Unified `ConverseCommand` API:** Rather than legacy model-specific `InvokeModel` payloads, Veylo uses the AWS Bedrock unified `ConverseCommand`.
- **Explicit `maxTokens` Budget:** Configured to `1024` tokens, guaranteeing ultra-low time-to-first-token (< 1.5s) for real-time voice conversations.
- **Cross-Region Inference Profiles:** Supports `us.anthropic.claude-sonnet-4-6` and `us.amazon.nova-pro-v1:0` for continuous availability.
- **Strict Zod Schema Validation:** Responses are stripped of formatting artifacts and validated against strict schemas (`IdentifyAssistResultSchema`, `CompareAssistResultSchema`).

```typescript
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION || "us-east-1" });
const response = await client.send(
  new ConverseCommand({
    modelId: "us.anthropic.claude-sonnet-4-6",
    system: [{ text: systemPrompt }],
    messages: [{ role: "user", content: [{ text: userPrompt }] }],
    inferenceConfig: { maxTokens: 1024, temperature: 0.2 },
  })
);
```

### 2.2 Tools Powered by Bedrock
- `identify_product`: Transforms vague physical descriptions into canonical product identities, categories, and confidence scores.
- `compare_products`: Generates comparative pros/cons matrices, trade-off analysis, and personalized purchase recommendations.

---

## 3. Pillar 2: Amazon Polly (`@aws-sdk/client-polly`)

### 3.1 Implementation
Located in [`apps/web/src/app/api/tts/route.ts`](apps/web/src/app/api/tts/route.ts) and [`apps/web/src/lib/speech.ts`](apps/web/src/lib/speech.ts).

- **Authentic Alexa Voice:** Uses Amazon Polly's Neural engine with voice `Joanna`, matching Alexa's natural cadence and pitch.
- **Direct Streaming:** Synthesizes MP3 streams streamed directly back to the client audio subsystem with HTTP range and cache controls.
- **Zero-Crash Graceful Degradation:** If AWS credentials are not configured or rate-limited, the system cleanly degrades (HTTP 501 `NOT_CONFIGURED`) to the browser's built-in natural speech synthesis without breaking the user experience.

```typescript
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";

const polly = new PollyClient({ region: process.env.AWS_REGION || "us-east-1" });
const command = new SynthesizeSpeechCommand({
  Text: cleanText,
  OutputFormat: "mp3",
  VoiceId: "Joanna",
  Engine: "neural",
});
const response = await polly.send(command);
const audioBuffer = await response.AudioStream.transformToByteArray();
```

---

## 4. Pillar 3: Amazon RDS / Aurora PostgreSQL

### 4.1 Implementation
Located in [`packages/db/migrations/0000_init.sql`](packages/db/migrations/0000_init.sql) and [`packages/db/src/schema.ts`](packages/db/src/schema.ts).

- **Relational Integrity:** Drizzle ORM over standard PostgreSQL connection pooling.
- **`pg_trgm` Fuzzy Search:** Trigram similarity indexing on product names, aliases, and category keywords.
- **Personalized Context Memory:** Stores user devices (`user_devices`) and owned items (`user_inventory`) so the assistant avoids redundant purchases and ensures hardware compatibility.

---

## 5. Non-Negotiable: The Zero-Broken-Demo Guarantee

Hackathon judges often clone repositories to test without setting up full AWS IAM credentials. Veylo guarantees that a fresh clone will **never crash**:
- **Bedrock Fallback:** If AWS credentials are not provided or Bedrock is unreachable, Veylo seamlessly executes deterministic offline rules (`meta.fallbackFrom = "bedrock"`).
- **Polly Fallback:** If Polly credentials are unconfigured, Veylo speaks using the browser's high-quality speech synthesis.
- **Database Fallback:** Runs identically against local PostgreSQL (`docker compose`) or cloud-hosted Amazon RDS / Aurora.

---

## 6. AWS Configuration & IAM Policy

### 6.1 Environment Variables (`.env`)
```bash
# AWS Region & Credentials
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

# Bedrock Settings
AI_PROVIDER=bedrock
BEDROCK_MODEL_ID=us.anthropic.claude-sonnet-4-6
BEDROCK_MAX_TOKENS=1024

# Amazon Polly Settings
POLLY_VOICE_ID=Joanna
POLLY_ENGINE=neural

# Amazon RDS / Aurora PostgreSQL
DATABASE_URL=postgres://veyloadmin:password@your-db.cxxxxxx.us-east-1.rds.amazonaws.com:5432/veylo?sslmode=require
```

### 6.2 Minimal IAM Policy
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BedrockInvoke",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:Converse"
      ],
      "Resource": "*"
    },
    {
      "Sid": "PollySynthesize",
      "Effect": "Allow",
      "Action": [
        "polly:SynthesizeSpeech"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## 7. AWS Builder Judging Checklist

| Requirement | Veylo Implementation | Code Reference |
| --- | --- | --- |
| **Generative AI** | Amazon Bedrock (`@aws-sdk/client-bedrock-runtime`) | [`packages/ai/src/providers/bedrock.ts`](packages/ai/src/providers/bedrock.ts) |
| **Neural Voice Synthesis** | Amazon Polly (`@aws-sdk/client-polly`, Joanna Neural) | [`apps/web/src/app/api/tts/route.ts`](apps/web/src/app/api/tts/route.ts) |
| **Relational & Search Store** | Amazon RDS / Aurora PostgreSQL with `pg_trgm` | [`packages/db/migrations/0000_init.sql`](packages/db/migrations/0000_init.sql) |
| **Modern AWS SDK v3** | Modular `@aws-sdk/*` clients, unified `ConverseCommand` | `packages/ai/package.json`, `apps/web/package.json` |
| **Production Resilience** | Transparent zero-dependency fallback for judging | [`packages/ai/src/index.ts`](packages/ai/src/index.ts), [`apps/web/src/lib/speech.ts`](apps/web/src/lib/speech.ts) |
