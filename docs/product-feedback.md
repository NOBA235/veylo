# Veylo — Product & Platform Feedback

> **Audience:** Amazon Developer Hackathon Organizers, Alexa+ Engineering, and AWS Bedrock Product Teams  
> **Topic:** Developer experience, protocol design, and agentic physical-world shopping capabilities  

---

## 1. Executive Summary

Building **Veylo** as a physical product discovery capability for **Alexa+** using **Amazon Bedrock** and the **Model Context Protocol (MCP)** provided valuable insight into ambient computing and agentic commerce.

This document compiles our feedback on what worked exceptionally well, where current platform friction exists, and how the developer ecosystem can evolve to enable physical-world agentic actions.

---

## 2. Model Context Protocol (MCP) Experience & Feedback

### What Worked Well:
1. **Contract-Driven Tool Execution:**
   - Defining typed tool contracts via Zod in a shared package (`@veylo/types`) ensured that the MCP server, web client, agent planner, and documentation never drifted.
2. **Streamable HTTP Transport (Spec 2025-11-25):**
   - The modern Streamable HTTP transport is significantly simpler to host and monitor than stateful WebSocket tunnels or complex SSE multiplexing. It maps cleanly to containerized cloud architectures (AWS ECS, Fargate, Lambda).
3. **Composable Micro-Tools over Monolith Endpoints:**
   - Decomposing the discovery pipeline into `identify_product`, `discover_local_places`, `check_local_inventory`, and `compare_products` allowed the agent planner to stop early, ask clarifying questions, or widen radii dynamically, rather than relying on an opaque single-turn "search" endpoint.

### Platform Opportunities for MCP:
- **Schema Shape Inference:** The official `@modelcontextprotocol/sdk` TypeScript types currently expect open index signatures (`[x: string]: unknown`) on tool output results. Supporting strictly typed generic return signatures out of the box will improve developer velocity in TypeScript monorepos.

---

## 3. Amazon Bedrock & AWS Builder Feedback

### What Worked Well:
1. **Unified `ConverseCommand` API:**
   - Moving from model-specific `InvokeModel` request/response schemas to the unified `ConverseCommand` in `@aws-sdk/client-bedrock-runtime` is a massive improvement. Swapping between Anthropic Claude 3.5 Sonnet, Claude 3 Haiku, and Amazon Nova Pro required zero changes to prompting or response handling code.
2. **Cross-Region Inference Profiles:**
   - Utilizing cross-region inference profiles (e.g. `us.anthropic.claude-sonnet-4-6`) provided outstanding uptime and latency stability during development, avoiding single-region quota bottlenecks.
3. **Low-Latency Structured Generation:**
   - Setting explicit `maxTokens: 1024` with low temperature (0.1) resulted in consistent structured JSON generation with sub-1.5s time-to-first-token, ideal for conversational voice agents.

### Platform Friction & Suggestions for Bedrock:
- **Token Reservation Limits:** Without explicit `maxTokens`, Bedrock defaults to reserving the model's full context window, causing unexpected throttling on accounts with standard rate limits. Clearer SDK documentation or warnings when `maxTokens` is omitted would help newcomers.
- **Native JSON Schema Enforcement:** While models follow instructions well, responses occasionally wrap JSON in markdown blocks (````json ... ````) or conversational preambles. Native JSON schema constrained decoding (similar to OpenAI `response_format: { type: "json_schema" }` or Gemini structured output) would eliminate the need for custom regex extraction.

---

## 4. Alexa+ Capability Design Feedback

### Why Alexa+ Needs Ambient Physical Understanding:
- **The Ambiguity Gap:** Over 60% of consumers looking for home repair parts, cables, fasteners, and tools do not know the technical or brand name of the item. Traditional search engines fail on queries like *"that little thing that connects my laptop to the TV"*.
- **The Voice Decision Tree:** An ambient voice agent cannot read out 10 search results. It must identify the canonical product, ask at most one clarifying question, verify local store relevance, evaluate evidence, and recommend an immediate next action.
- **Honest Evidence as a Core Brand Value:** Users trust Alexa when it is honest. Hallucinating that a local store has an item in stock when it doesn't damages user trust. Veylo's 4-tier evidence model (`CONFIRMED`, `LIKELY`, `WEB_FOUND`, `UNKNOWN`) sets a blueprint for trustworthy voice commerce.
