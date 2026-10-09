# Veylo MCP tools

Veylo is a self-hosted MCP server. An agent (Alexa+, or any MCP client) composes these tools; Veylo's own web UI and planner use exactly the same ones through the typed client in `packages/mcp-client`.

| | |
| --- | --- |
| MCP spec | **2025-11-25** (the server refuses to start if the installed SDK cannot speak it) |
| Transport | **Streamable HTTP**, `POST /mcp`, default `http://127.0.0.1:8787/mcp` |
| Mode | Stateless: a fresh server + transport per request. `GET`/`DELETE /mcp` return 405 |
| Responses | `application/json` by default; set `MCP_JSON_RESPONSE=false` for SSE-framed responses. Both are tested |
| Health | `GET /healthz` |
| SDK | Official `@modelcontextprotocol/sdk` (TypeScript) |

## Security defaults

- Binds to `127.0.0.1`. Binding elsewhere requires `MCP_AUTH_TOKEN` (or the explicit `MCP_ALLOW_INSECURE_PUBLIC=true`).
- **Origin validation:** a request carrying an `Origin` header is refused (403) unless it is loopback or listed in `MCP_ALLOWED_ORIGINS`. Non-browser clients send no `Origin` and are unaffected.
- **Bearer auth (optional):** with `MCP_AUTH_TOKEN` set, every request needs `Authorization: Bearer <token>` (constant-time comparison, 401 otherwise).
- This is not full MCP authorization (OAuth). Add that before exposing the server publicly.

## Connecting and verifying

```bash
pnpm bootstrap && pnpm dev                 # Postgres, migrate, seed, then the server
pnpm mcp:conformance                       # SDK-free JSON-RPC checks against http://127.0.0.1:8787/mcp
npx @modelcontextprotocol/inspector        # MCP Inspector: choose Streamable HTTP, URL above
```

`pnpm mcp:conformance` speaks raw JSON-RPC (no SDK) and checks: `initialize` negotiates `2025-11-25`; `notifications/initialized` is accepted; `tools/list` returns exactly the ten tools with input and output schemas; every tool can be called with sample input without a protocol or internal error; invalid arguments and unknown tools are rejected; `GET /mcp` is 405; an unlisted browser `Origin` gets 403; and, when a token is configured, a request without it gets 401. Note it calls `create_shopping_list`, which inserts a row.

## Results and errors

Success returns both forms, identical by construction (every result is validated against its contract before it leaves the server, then round-tripped through JSON):

- `structuredContent`: the typed output object (declared as each tool's `outputSchema`)
- `content[0].text`: the same object as JSON, for clients that only read text

Failure is a tool result with `isError: true` (not a JSON-RPC error), so the calling model can read it and recover. The code is in the text prefix and in `_meta["veylo/error"]`; error results carry no `structuredContent`.

| Code | Meaning | Typical recovery |
| --- | --- | --- |
| `INVALID_INPUT` | Arguments failed validation; the message names the field | Fix the argument |
| `NOT_FOUND` | Unknown `storeId` / `placeId` | Call `discover_local_places` first |
| `UNKNOWN_CATEGORY` | Cannot tell which stores sell the product | Pass `category` or `storeCategories` |
| `GEOCODE_FAILED` | Location text could not be resolved | Ask the user again, or pass `"lat,lon"` |
| `NOT_CONFIGURED` | Optional integration not set up (web search, place source, geocoder) | Skip the step |
| `UPSTREAM_UNAVAILABLE` | A data source is down | Retry later or continue without it |
| `INTERNAL_ERROR` | Unexpected failure, or a result was withheld for violating its contract | Report |

Internal details are never included in error text.

### Real examples

`tools/call` for `identify_product` (output is exact, from the executor over the seeded catalogue):

```json
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"identify_product","arguments":{"description":"I need that little thing that lets me connect my laptop to a TV. I don't know what it's called."}}}
```

`structuredContent` of the result:

```json
{
  "product": "USB-C to HDMI adapter",
  "category": "video adapters",
  "confidence": 0.79,
  "reasoningSummary": "Your description overlaps with how USB-C to HDMI adapter is described (\"small adapter to connect a laptop to a TV\").",
  "alternatives": [
    "USB-C hub with HDMI",
    "USB-C to HDMI cable",
    "Mini DisplayPort to HDMI adapter",
    "HDMI cable"
  ],
  "aliases": [
    "USB-C HDMI adapter",
    "Type-C to HDMI adapter",
    "USB Type-C to HDMI converter",
    "HDMI dongle",
    "laptop to TV adapter"
  ],
  "uncertainty": "Often confused with DisplayPort to HDMI adapter, USB-C to USB-A adapter. Compatibility: Needs a USB-C port with video output (DisplayPort Alt Mode or Thunderbolt).",
  "meta": {
    "provider": "rules"
  }
}
```

An unknown store:

```json
{
  "isError": true,
  "content": [
    {
      "type": "text",
      "text": "NOT_FOUND: Unknown storeId \"osm:node/999\". Run discover_local_places first."
    }
  ],
  "_meta": {
    "veylo/error": {
      "code": "NOT_FOUND",
      "message": "Unknown storeId \"osm:node/999\". Run discover_local_places first.",
      "details": {
        "storeId": "osm:node/999"
      }
    }
  }
}
```

Invalid input:

```json
{
  "isError": true,
  "content": [
    {
      "type": "text",
      "text": "INVALID_INPUT: description: Required"
    }
  ],
  "_meta": {
    "veylo/error": {
      "code": "INVALID_INPUT",
      "message": "description: Required"
    }
  }
}
```

## Tools

All inputs and outputs are Zod schemas in `packages/types/src/tools.ts`; the server derives its `inputSchema`/`outputSchema` from them, so this table cannot drift from the implementation. Annotations: all tools are read-only except `create_shopping_list`; none is destructive.

| Tool | Purpose | Key inputs | Notes |
| --- | --- | --- | --- |
| `identify_product` | Vague description to a likely product | `description`, optional `visualDescription`, `imageUrl`, `constraints` | Returns `confidence`, `alternatives`, `uncertainty` and, when ambiguity matters, `clarifyingQuestion`: **ask it, don't guess**. `meta` reports the provider and any fallback. Images are not analysed yet |
| `search_products` | Search the product knowledge base | `query`, optional `category` (leaf or parent), `attributes`, `limit` | Evidence strings say the data is curated catalogue knowledge, not stock |
| `discover_local_places` | Nearby stores whose type fits the product | `product`, `location` (place name or `"lat,lon"`), optional `category`, `radiusMeters`, `storeCategories` | Always `inventoryStatus: UNKNOWN`: being the right kind of store is not stock evidence |
| `check_local_inventory` | Evidence-backed status for one store | `storeId` (from discovery), `product` | `CONFIRMED`/`LIKELY`/`WEB_FOUND`/`UNKNOWN` with an evidence list; the schema rejects states lacking their evidence. Call per store, not for all |
| `compare_products` | Compare candidate products | `products` (2+), optional `userRequirements` (`compatibility`, `extraPorts`, `urgency`), `location` | Availability and distance come only from evidence gathered this session; no prices (none are verified) |
| `get_place_details` | Address, hours, phone, website | `placeId` | Only fields the source listed; evidence says they may be stale |
| `get_directions` | Route link | `placeId`, optional `origin`, `mode` | A Google Maps URL; no routing service is called |
| `contact_store` | A way to contact the store | `storeId`, optional `product` | Returns `tel:` or the website, else `none`. Never places a call or sends a message |
| `search_web` | Web research fallback | `query`, optional `location`, `limit` | `trust` is always `WEB_FOUND`; needs `BRAVE_SEARCH_API_KEY`, else `NOT_CONFIGURED` |
| `create_shopping_list` | Persist items to buy | `items[{product, quantity (default 1), notes}]` | Resolves names to catalogue names; stored in Postgres |

Not yet live (Phase 7): the place source (Overpass), geocoder (Nominatim) and web evidence providers. Until they are configured, `discover_local_places` returns `NOT_CONFIGURED` for place names and for `"lat,lon"` alike, rather than inventing stores.

## Composing the tools

A good agent does not call everything. A typical run, with the reasons it may stop early:

1. `identify_product`. If `clarifyingQuestion` is present, ask the user and stop. If `confidence` is high and there is no question, continue.
2. Ask local-vs-online and the location only if unknown. If online, optionally `search_web`, then answer.
3. `discover_local_places`. If empty, widen the radius once, then say so.
4. `check_local_inventory` on the best-fitting store; check more only while nothing is `CONFIRMED`.
5. `compare_products` only when alternatives exist and confidence is moderate or the user stated requirements.
6. `get_place_details` and `get_directions` for the best option; `contact_store` if the user wants to call.

`packages/agent` implements exactly this as a bounded loop (max 8 tool calls per run) with an inspectable trace, using only these tools. See `docs/evidence-model.md` for what each inventory state means; the server's MCP `instructions` tell connecting agents the same rule: only `CONFIRMED` means current stock.
