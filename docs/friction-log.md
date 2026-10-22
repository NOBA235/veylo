# Developer Friction Log: Veylo AWS & Ambient Stack

> **Submission Track:** Alexa+ / AWS Builder Mini Challenge  
> **Project:** Veylo ([GitHub Repository](https://github.com/NOBA235/veylo))  
> **Document Purpose:** Engineering friction log capturing specific technical friction points encountered while integrating AWS SDK v3 (Amazon Bedrock, Amazon Polly) and the Model Context Protocol (MCP), accompanied by severity ratings, workarounds, and actionable suggestions for AWS and Amazon Developer platform teams.

---

## Summary of Friction Log Entries

| # | Task / Area | Component | Severity | Workaround Status |
|---|---|---|---|---|
| **1** | Cross-Region Inference Profile Resolution | Amazon Bedrock Runtime (`ConverseCommand`) | **High** | Resolved with profile ID mapping |
| **2** | Streaming Audio Consumption in Web Frameworks | Amazon Polly (`SynthesizeSpeechCommand`) | **Medium** | Resolved via ArrayBuffer slice wrapper |
| **3** | Grammar-Constrained JSON Schema Extraction | Amazon Bedrock Reasoning Output | **Medium** | Resolved via Zod schema parser fallback |
| **4** | Streamable HTTP Spec & Origin Validation | MCP Server (`@modelcontextprotocol/sdk`) | **Low** | Resolved via loopback origin filter |

---

## Friction Log Entry 1: Amazon Bedrock Cross-Region Profile Resolution

### 1. Specific Task Attempted
Invoking Anthropic Claude 3.5 Sonnet on-demand via the modern unified `ConverseCommand` API in `@aws-sdk/client-bedrock-runtime` within `us-east-1`.

### 2. Steps Taken
1. Initialized `BedrockRuntimeClient` configured with `region: "us-east-1"`.
2. Passed `modelId: "anthropic.claude-3-5-sonnet-20241022-v2:0"` into `ConverseCommand`.
3. Dispatched request using standard IAM credentials.

### 3. Expected vs. Actual Result
- **Expected:** Successful invocation of Claude 3.5 Sonnet returning text content blocks.
- **Actual Result:** AWS Bedrock returned `ValidationException` / `ResourceNotFoundException`:
  > *"Invocation of model ID 'anthropic.claude-3-5-sonnet-20241022-v2:0' is not supported directly. Please use a system-defined inference profile ID (e.g. us.anthropic.claude-sonnet-4-6)."*

### 4. Severity Rating
**High** — Blocker for initial developer onboarding. Developers following canonical foundation model naming conventions encounter an abrupt failure requiring deep AWS documentation research.

### 5. Workaround Used
Updated `BEDROCK_MODEL_ID` configuration to standardized cross-region inference profile IDs (`us.anthropic.claude-sonnet-4-6` and `us.amazon.nova-pro-v1:0`). Added runtime fallback to Amazon Nova Pro and offline deterministic rules to ensure zero downtime.

### 6. Actionable Suggestion for AWS
- **SDK Auto-Resolution:** Add an SDK client configuration flag, e.g., `crossRegionRouting: "auto"`, in `@aws-sdk/client-bedrock-runtime`. When enabled, the SDK can automatically map canonical foundation model IDs (`anthropic.claude-3-5-sonnet-...`) to the active regional/cross-region profile ID for the client's configured `region`.
- **Improved Error Context:** Update the AWS API error payload to include a machine-readable `recommendedInferenceProfileId` field so client SDKs can provide automatic suggestions or hints.

---

## Friction Log Entry 2: Polly AudioStream Consumption in Modern Full-Stack Runtimes

### 1. Specific Task Attempted
Piping the audio output stream from Amazon Polly's `SynthesizeSpeechCommand` directly to an HTTP client using Next.js 15 App Router Route Handlers (`/api/tts`).

### 2. Steps Taken
1. Executed `SynthesizeSpeechCommand` with `Engine: "neural"`, `VoiceId: "Joanna"`, `OutputFormat: "mp3"`.
2. Attempted to return `new Response(response.AudioStream, { headers: { "Content-Type": "audio/mpeg" } })`.

### 3. Expected vs. Actual Result
- **Expected:** `response.AudioStream` is accepted as a standard Web `BodyInit` (`ReadableStream<Uint8Array>`), streaming chunks directly to the client.
- **Actual Result:** Type error and runtime incompatibility: In the AWS SDK v3 Node.js distribution, `AudioStream` is typed as an `SdkStream<Readable | Blob | ReadableStream>`, which does not satisfy Next.js TypeScript `BodyInit` constraints (`Uint8Array<ArrayBufferLike> is missing URLSearchParams properties`).

### 4. Severity Rating
**Medium** — Impairs idiomatic streaming in modern web runtimes (Next.js App Router, Cloudflare Workers, AWS Lambda streaming responses).

### 5. Workaround Used
```typescript
// Extracted byte array and sliced underlying ArrayBuffer to provide compliant BodyInit
let audioBuffer: Uint8Array;
const stream = response.AudioStream as { transformToByteArray?: () => Promise<Uint8Array> };
if (typeof stream.transformToByteArray === "function") {
  audioBuffer = await stream.transformToByteArray();
} else {
  const chunks: Buffer[] = [];
  for await (const chunk of response.AudioStream as unknown as AsyncIterable<Buffer | Uint8Array>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  audioBuffer = Buffer.concat(chunks);
}
const arrayBuffer = audioBuffer.buffer.slice(
  audioBuffer.byteOffset,
  audioBuffer.byteOffset + audioBuffer.byteLength
);
return new Response(arrayBuffer as BodyInit, { ... });
```

### 6. Actionable Suggestion for AWS
- **Web Streams by Default:** Provide an explicit `.toWebStream()` method on all streaming output bodies in AWS SDK v3, or align the Node.js build with the standard Web Streams API (`ReadableStream`).
- **HTTP/2 Duplex Synthesis:** Support bidirectional duplex streaming so speech synthesis can start emitting audio bytes as the LLM streams tokens, reducing latency in ambient voice pipelines.

---

## Friction Log Entry 3: Lack of Native Grammar-Constrained JSON Decoding in Bedrock Converse

### 1. Specific Task Attempted
Requesting strictly structured JSON output for product hypotheses and multi-product trade-off evaluations from foundation models via Bedrock `ConverseCommand`.

### 2. Steps Taken
1. Provided detailed JSON schema definitions and instructions within the system prompt.
2. Executed `ConverseCommand` and inspected `response.output.message.content[0].text`.

### 3. Expected vs. Actual Result
- **Expected:** 100% syntactically valid JSON matching the schema on every invocation.
- **Actual Result:** Models occasionally enclosed JSON in markdown code blocks (` ```json ... ``` `), prepended conversational preambles ("Here is the requested analysis:"), or appended conversational sign-offs, causing standard `JSON.parse` invocations to fail.

### 4. Severity Rating
**Medium** — Critical for agent tool calling and structured workflows where malformed outputs break downstream execution loops.

### 5. Workaround Used
Created [`packages/ai/src/util.ts`](../packages/ai/src/util.ts) with `extractJsonFromText`:
- Employs regex extraction to isolate JSON blocks within markdown fences or outer brackets.
- Validates parsed payloads against strict Zod schemas (`IdentifyAssistResultSchema`, `CompareAssistResultSchema`).
- Gracefully degrades to deterministic offline rules if schema validation fails.

### 6. Actionable Suggestion for AWS
- **Native JSON Schema Mode:** Introduce a first-class `responseFormat: { type: "json_schema", schema: JsonSchemaObject }` parameter directly in `ConverseCommand` (similar to structured output features in leading inference providers). Enforcing constrained decoding at token sampling time completely eliminates markdown parsing overhead and token hallucinations.

---

## Friction Log Entry 4: Model Context Protocol (MCP) Streamable HTTP Handshake

### 1. Specific Task Attempted
Connecting browser-based clients and external agent runtimes to a self-hosted Model Context Protocol server exposing tools over Streamable HTTP (Spec 2025-11-25).

### 2. Steps Taken
1. Implemented MCP HTTP endpoint on port 8787 handling JSON-RPC requests.
2. Connected Next.js web application and CLI test suites to `http://127.0.0.1:8787/mcp`.

### 3. Expected vs. Actual Result
- **Expected:** Seamless tool discovery and execution.
- **Actual Result:** Browser security checks (CORS and Origin header inspection) required rigorous origin matching. Standard tools and test runners dispatching requests without `Origin` headers required different handling than browser-initiated requests.

### 4. Severity Rating
**Low** — Expected security boundary, but requires careful configuration.

### 5. Workaround Used
Implemented a whitelist origin validator in `apps/mcp-server/src/config.ts` allowing loopback origins (`localhost`, `127.0.0.1`) by default, while supporting configurable `MCP_ALLOWED_ORIGINS` and token-based Bearer authentication for public or remote interfaces.

### 6. Actionable Suggestion for AWS / Alexa+
- **First-Class MCP Adapter in Alexa Skills Kit:** Allow Alexa+ to natively register and ingest remote MCP server URLs (over Streamable HTTP). Rather than writing custom Alexa skill boilerplate and lambda bridges, ambient voice planners could discover and execute standardized MCP tool contracts natively.

