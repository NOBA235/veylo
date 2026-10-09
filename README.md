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

| Phase | Scope | State |
| --- | --- | --- |
| 0 | Monorepo, TS strict, lint/format, Docker Postgres, `.env.example` | Scaffolded, not yet run end to end |
| 1 | Schema, migration runner, seed (69 products, 24 categories) | Seed data validated offline; migration/seed not yet run against a live Postgres |
| 2 | Core services: identify, search, discover, inventory evidence, compare, details/directions/contact | Written and unit-tested (73 tests; Postgres repository not yet run against a live DB) |
| 3 | MCP server (Streamable HTTP, spec 2025-11-25), typed client, all 10 tools, planner loop with trace | Written. Executor, guard, config, planner, conformance client tested here. **Server transport and SDK client not yet run** (no SDK or network where this was built): run `pnpm test` and `pnpm mcp:conformance` |
| 4–9 | Web UI, AI providers, Bedrock, Overpass/geocoding, Alexa+, polish | Not started |

Nothing below is claimed as working until its phase is marked done here.

## Quickstart

```bash
cp .env.example .env     # AI_PROVIDER=rules by default: no keys needed
pnpm install
pnpm bootstrap           # docker compose up -d + migrate + seed
pnpm seed:validate       # offline integrity check of the seed data
```

`pnpm dev` starts the MCP server on `http://127.0.0.1:8787/mcp` (the web UI arrives in Phase 4).
Live nearby-store lookup needs the Phase 7 place source and geocoder; until then `discover_local_places` reports `NOT_CONFIGURED`.

```bash
pnpm mcp:conformance                 # SDK-free JSON-RPC checks against the running server
npx @modelcontextprotocol/inspector  # or explore with the MCP Inspector (Streamable HTTP)
```

## Tests

```bash
pnpm test         # Node's built-in test runner via tsx; needs Node 22+
pnpm typecheck
TEST_DATABASE_URL=postgres://veylo:veylo@localhost:5432/veylo pnpm test   # also runs the Postgres repository test
```

## Architecture

See [`docs/architecture.md`](docs/architecture.md). Tool contracts (Zod) live in `packages/types/src/tools.ts` and are the single source of truth for the MCP server, the web client and the docs.

## MCP tools (see `docs/mcp-tools.md`)

`identify_product`, `search_products`, `discover_local_places`, `check_local_inventory`, `compare_products`, `get_place_details`, `get_directions`, `contact_store`, `search_web`, `create_shopping_list`.

MCP spec target: **2025-11-25 or later**, Streamable HTTP, endpoint `/mcp`, port `8787`.

## Evidence model

Every local result carries one of `CONFIRMED`, `LIKELY`, `WEB_FOUND`, `UNKNOWN`. The schema for `check_local_inventory` rejects `CONFIRMED` without an evidence record. Veylo never fabricates inventory, prices, opening hours, contacts or reviews.

## AWS Builder Mini Challenge Integration

Status: **planned for Phase 6, not implemented yet.** Amazon Bedrock will be a real provider in the `AI_PROVIDER=gemini|openai|bedrock|rules` abstraction (`packages/ai/src/providers/bedrock.ts`, `BedrockRuntimeClient` + `ConverseCommand`, explicit `maxTokens`, Zod-validated output, fallback to `rules`). Veylo must keep working with `AI_PROVIDER=rules` and no AWS credentials. Full write-up will live in `docs/aws-builder-integration.md`.

## Alexa+ integration

Phase 8. If live Alexa+ access is unavailable, the demo will be a clearly labeled simulation driving the same real MCP server.

## Judging criteria mapping (to complete in Phase 9)

- **Tech implementation:** MCP 2025-11-25 + Streamable HTTP, Bedrock provider, real data, evidence model
- **Design:** minimal UI, clarification flow, inspectable agent trace
- **Potential impact:** people routinely lack the name for the thing they need
- **Quality of idea:** UNKNOWN → ACTION composition, Alexa+ capability, AWS Builder layer
