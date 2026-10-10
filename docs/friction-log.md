# Veylo — Developer Friction Log

This document details technical friction points, edge cases, and unexpected hurdles encountered during the design, implementation, and verification of Veylo, along with their solutions.

---

## 1. Friction Point: MCP TypeScript SDK Tool Result Type Incompatibilities

### The Problem
During strict TypeScript compilation (`tsc -p tsconfig.json`) of the MCP server, `server.registerTool(...)` failed with TS2345:
```text
Argument of type '(args: unknown) => Promise<ToolResult>' is not assignable to parameter of type '... => Promise<CallToolResult>'.
Property '[x: string]: unknown' is missing in type 'ToolResult'.
```

### Root Cause
The official `@modelcontextprotocol/sdk` defines `CallToolResult` with an open index signature (`{ [x: string]: unknown; content: ... }`) to permit arbitrary JSON-RPC extensions. Our domain-level `ToolResult` interface strictly specified only known fields (`content`, `structuredContent`, `isError`, `_meta`), causing strict compiler rejections.

### Resolution
- Created a safe boundary adapter in `apps/mcp-server/src/server.ts` that casts handler return types to `Promise<CallToolResult>` while retaining 100% strict Zod schema validation within `@veylo/core`.
- Preserved domain integrity: core services remain completely free of direct `@modelcontextprotocol/sdk` imports.

---

## 2. Friction Point: Amazon Bedrock Token Throttling & Output Parsing

### The Problem
When invoking Claude 3.5 Sonnet on Amazon Bedrock without setting an explicit token budget, requests would occasionally stall or encounter account quota throttling errors, especially during rapid iterative testing. Furthermore, Bedrock would occasionally envelope JSON responses in markdown fences:
````markdown
```json
{
  "product": "USB-C to HDMI adapter", ...
}
```
````

### Root Cause
1. AWS Bedrock reserves the model's entire max token limit (e.g. 8,192 tokens) from account rate buckets if `maxTokens` is not explicitly declared.
2. Large Language Models frequently output markdown formatting unless explicitly constrained by decoding grammars.

### Resolution
1. **Explicit Budgeting:** Always passed `maxTokens: 1024` (configurable via `BEDROCK_MAX_TOKENS`) in `ConverseCommand.inferenceConfig`.
2. **Defensive JSON Extraction:** Created [`extractJsonFromText()`](file:///c:/Users/User/Downloads/veylo-alexa/veylo/packages/ai/src/util.ts) in `@veylo/ai` to strip markdown fences, locate balanced JSON brackets `{ ... }`, parse the payload, and validate it against strict Zod schemas (`IdentifyAssistResultSchema`).
3. **Graceful Fallback:** Wrapped Bedrock client execution in a try/catch block that logs warnings and seamlessly reverts to the deterministic `rules` provider without breaking the active demo.

---

## 3. Friction Point: Public OpenStreetMap Overpass API Latency & Reliability

### The Problem
Public Overpass API endpoints (e.g. `overpass-api.de`) can experience latency spikes (3–10 seconds) or transient 429/504 errors when multiple spatial queries are sent simultaneously.

### Root Cause
Public community-hosted OSM mirrors prioritize batch map edits and rate-limit aggressive queries that use large search radii.

### Resolution
1. **Multi-Endpoint Fallback:** `OverpassPlaceSource` defines a prioritized list of mirrors (`overpass-api.de`, `lz4.overpass-api.de`, `overpass.kumi.systems`) and automatically cascades if the primary mirror fails.
2. **In-Memory Query Caching:** Cached spatial queries by rounded coordinates and store types with a 30-minute TTL.
3. **Hybrid Fixture Fallback:** In demo mode (`DEMO_MODE=true`), the system includes Austin fixtures for the primary demo while simultaneously allowing live Overpass queries for any other global city.
4. **Timeout Enforcers:** Attached `AbortController` timeouts (default 10s) to prevent stalled HTTP connections.

---

## 4. Friction Point: Preventing Hallucinated Inventory Claims

### The Problem
A major risk in AI shopping assistants is the "directory fallacy": assuming that because a store appears in a search result for "hardware", it currently has a specific SKU in stock on the physical shelf.

### Root Cause
Opaque chatbot prompts encourage the model to synthesize persuasive, confident-sounding answers even when underlying stock data is completely absent.

### Resolution
1. **4-Tier Trust Model:** Implemented explicit states: `CONFIRMED`, `LIKELY`, `WEB_FOUND`, `UNKNOWN`.
2. **Schema-Enforced Honesty:** The Zod output schema for `check_local_inventory` strictly rejects `CONFIRMED` unless accompanied by a verified stock evidence signal observed within 24 hours.
3. **Negative Evidence Verification:** When no stock signal exists, Veylo reports `UNKNOWN` with full transparency: *"Listed as a hardware store. Store type fit is 1.0, but current shelf stock is unverified."*

---

## 5. Friction Point: Zero-Dependency Developer Quickstart

### The Problem
Hackathon judges evaluate dozens of projects and may not have Docker running, PostgreSQL installed, or paid AWS credentials configured.

### Root Cause
Projects that require complex multi-container setup or paid cloud accounts frequently fail evaluation due to environment mismatch.

### Resolution
- Enabled complete offline execution:
  - `DEMO_MODE=true` loads the 69-product seed catalog directly from JSON into memory.
  - `AI_PROVIDER=rules` uses fast, deterministic trigram and synonym matching without any API keys.
  - The web UI includes an automatic in-process fallback loopback client if the standalone MCP server process is not running.
- Evaluators can clone the repo, run `pnpm install` and `pnpm dev`, and immediately experience the full product.
