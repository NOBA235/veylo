# Veylo — See it. Say it. Find it.

Veylo is a capability an Alexa+ agent can call to turn an ambiguous request ("that little thing that connects my laptop to the TV") into a concrete real-world action: what the thing probably is, which nearby stores are relevant, how much evidence there is that they stock it, and what to do next.

**UNKNOWN → ACTION:** description → product hypotheses → category → store types → real places → evidence → comparison → directions / contact.

## Hackathon declaration

- Event: Amazon Developer Hackathon (deadline Oct 23, 2026, 12:00pm PDT)
- Primary track: **Alexa+**
- Mini challenge: **AWS Builder** (Amazon Bedrock)
- Open Source mini challenge: **not entered** (update this line if the repo goes public)
- License: MIT (see `LICENSE`)

## Status

| Scope | State |
| --- | --- |
| Monorepo, TS strict, lint/format, Docker Postgres, `.env.example` | Complete |
| Schema, migration runner, seed (69 products, 24 categories) | Complete, seed validated offline |
| Core services: identify, search, discover, inventory evidence, compare, details/directions/contact | Complete & unit-tested (88 tests passing) |
| MCP server (Streamable HTTP, spec 2025-11-25), typed client, all 10 tools, planner loop with trace | Complete & verified passing official conformance suite |
| Web UI (Next.js 15, React 19, Tailwind CSS, Echo Show simulation modal, inspectable trace) | Complete, builds cleanly (`next build`) |
| AI Provider Abstraction (`@veylo/ai` supporting `rules`, `bedrock`, `gemini`, `openai`) | Complete & tested with automatic graceful offline fallback |
| Overpass/OSM local discovery & geocoding (`@veylo/local-discovery`) | Complete: `OverpassPlaceSource`, `NominatimGeocoder`, `WebEvidenceProvider`, `CachedPlaceStore` |
| Alexa+ voice simulation & capability guides | Complete: Echo Show 10 multimodal simulator, voice synthesis, MCP inspection, demo scripts |
| Demo Polish & Final Hackathon Deliverables | Complete |

## Quickstart

```bash
cp .env.example .env     # AI_PROVIDER=rules by default: no keys needed
pnpm install
pnpm bootstrap           # docker compose up -d + migrate + seed (or run DEMO_MODE=true)
pnpm seed:validate       # offline integrity check of the seed data
```

`pnpm dev` starts the MCP server on `http://127.0.0.1:8787/mcp` and the web UI on `http://localhost:3000`.

```bash
pnpm mcp:conformance                 # JSON-RPC conformance check against the running server
npx @modelcontextprotocol/inspector  # explore with the official MCP Inspector (Streamable HTTP)
```

## Tests

```bash
pnpm test         # Node's built-in test runner via tsx across all workspace packages
pnpm typecheck    # Strict TypeScript checks across monorepo
```

## Architecture

See [`docs/architecture.md`](docs/architecture.md). Tool contracts (Zod) live in `packages/types/src/tools.ts` and are the single source of truth for the MCP server, the web client and the docs.

## MCP tools (see `docs/mcp-tools.md`)

`identify_product`, `search_products`, `discover_local_places`, `check_local_inventory`, `compare_products`, `get_place_details`, `get_directions`, `contact_store`, `search_web`, `create_shopping_list`.

MCP spec target: **2025-11-25 or later**, Streamable HTTP, endpoint `/mcp`, port `8787`.

## Evidence model

Every local result carries one of `CONFIRMED`, `LIKELY`, `WEB_FOUND`, `UNKNOWN`. The schema for `check_local_inventory` rejects `CONFIRMED` without an evidence record. Veylo never fabricates inventory, prices, opening hours, contacts or reviews.

## AWS Builder Mini Challenge Integration

Amazon Bedrock is integrated as a load-bearing AI intelligence layer for structured product identification and trade-off comparison.

- **Service:** Amazon Bedrock via `@aws-sdk/client-bedrock-runtime` (`BedrockRuntimeClient`)
- **API:** Modern unified `ConverseCommand` API
- **Models:** Cross-region inference profile IDs (e.g. `us.anthropic.claude-sonnet-4-6`)
- **Safety & Reliability:** Explicit `maxTokens` (1024), Zod output validation, and instant fallback to offline `rules` provider if credentials are not configured.
- **Detailed Documentation:** See [`docs/aws-builder-integration.md`](docs/aws-builder-integration.md) for full architecture, code links, IAM setup, and testing.

## Alexa+ integration

Veylo exposes composable MCP tools purpose-built for Alexa+ agents, accompanied by an interactive Echo Show 10 modal in the web UI.

- **Architecture & Capability Guide:** [`docs/alexa-plus-integration.md`](docs/alexa-plus-integration.md) (system prompts, MCP tool schemas, agent directives)
- **Live Demo Walkthrough Script:** [`docs/demo-script.md`](docs/demo-script.md) (killer demo & second demo step-by-step)
- **3-Minute Video Submission Script:** [`docs/demo-video-script.md`](docs/demo-video-script.md) (timed screen & audio walkthrough)

## Hackathon Judging Criteria Mapping

- **Technical Implementation:**
  - Real self-hosted Model Context Protocol server (spec 2025-11-25) using Streamable HTTP on port 8787.
  - Amazon Bedrock integration via `@aws-sdk/client-bedrock-runtime` using `ConverseCommand` and cross-region profiles.
  - Real OpenStreetMap / Overpass spatial queries and Nominatim geocoding in `@veylo/local-discovery`.
  - Strict evidence-first inventory trust engine rejecting fabricated availability.
- **Design & User Experience:**
  - Clean Next.js 15 App Router UI with React 19 and Tailwind CSS.
  - Ambient conversational experience with an interactive Echo Show 10 simulation modal and spoken voice synthesis.
  - Transparent, inspectable bounded agent planner trace (max 8 steps, zero leaked private CoT).
- **Potential Impact:**
  - Eliminates the universal human frustration of knowing what physical object you need without knowing what it is called.
  - Directly empowers ambient Alexa+ devices to become real-world shopping navigators rather than passive search engines.
- **Quality of Idea & Originality:**
  - **UNKNOWN → ACTION:** Orchestrates intent hypothesis, category deduction, store relevance, live local discovery, evidence verification, trade-off comparison, and concrete navigation.
  - Stacked track excellence: Primary **Alexa+** capability combined with load-bearing **AWS Builder** Bedrock integration.

## Documentation Index

- Architecture Overview: [`docs/architecture.md`](docs/architecture.md)
- MCP Tools Specification: [`docs/mcp-tools.md`](docs/mcp-tools.md)
- AWS Builder Mini Challenge Integration: [`docs/aws-builder-integration.md`](docs/aws-builder-integration.md)
- Alexa+ Capability & Architecture Guide: [`docs/alexa-plus-integration.md`](docs/alexa-plus-integration.md)
- Evidence Trust Model: [`docs/evidence-model.md`](docs/evidence-model.md)
- Live Demo Walkthrough Script: [`docs/demo-script.md`](docs/demo-script.md)
- 3-Minute Hackathon Video Script: [`docs/demo-video-script.md`](docs/demo-video-script.md)
- Platform & Product Feedback: [`docs/product-feedback.md`](docs/product-feedback.md)
- Developer Friction Log: [`docs/friction-log.md`](docs/friction-log.md)
- Feature Requests & Roadmap: [`docs/feature-requests.md`](docs/feature-requests.md)
- Submission & Acceptance Checklist: [`docs/submission-checklist.md`](docs/submission-checklist.md)
