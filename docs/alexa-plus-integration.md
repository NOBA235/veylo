# Alexa+ Integration Architecture & Capability Guide

> **Primary Hackathon Target:** Alexa+ Track  
> **Protocol:** Model Context Protocol (MCP) Spec 2025-11-25+ (Streamable HTTP)  
> **Server Endpoint:** `http://127.0.0.1:8787/mcp`  
> **Interactive Simulation:** Echo Show 10 modal in Veylo Web UI  

---

## 1. Executive Summary

People express physical-world shopping needs conversationally with high ambiguity:
> *"Alexa, what's that little adapter I need to connect my laptop to the TV?"*  
> *"Alexa, I need that white tape plumbers wrap around pipe threads."*

Generic search engines require known product keywords, and generic chatbots hallucinate store inventory. 

**Veylo** bridges this gap as an **agent capability** for **Alexa+**:
1. Translates ambiguous descriptions into concrete product hypotheses with confidence ratings and alternatives.
2. Identifies matching real-world retail store categories (e.g. video adapters → electronics, computer, mobile stores).
3. Discovers nearby physical retailers using OpenStreetMap / Overpass.
4. Gathers store and web evidence to determine strict inventory trust states (`CONFIRMED`, `LIKELY`, `WEB_FOUND`, `UNKNOWN`).
5. Synthesizes concise voice responses paired with multimodal display cards for Echo Show 10, Fire TV, and the Alexa mobile app.

---

## 2. Architectural Flow

```text
User Speech (Far-field Microphone)
        │
        ▼
   [Alexa+ Agent Core]
        │
   (Detects ambiguous physical product need)
        │
        ▼
   [Model Context Protocol (MCP) Streamable HTTP Client]
        │  POST /mcp (JSON-RPC 2.0)
        ▼
 ┌─────────────────────────────────────────────────────────┐
 │                   Veylo MCP Server                      │
 │                                                         │
 │  1. identify_product()      ──► Amazon Bedrock / Rules  │
 │  2. discover_local_places() ──► OpenStreetMap / Overpass│
 │  3. check_local_inventory() ──► Evidence Engine         │
 │  4. compare_products()      ──► Bedrock Trade-offs      │
 │  5. get_directions()        ──► Routing & Maps Link     │
 └─────────────────────────────────────────────────────────┘
        │
        ▼
   [Alexa+ Agent Response Synthesis]
   ├─ Spoken Response (Voice Dialogue & Clarification)
   └─ Echo Show Multimodal Display Card (APL / Visual Canvas)
```

---

## 3. Conversational Interaction Paradigm

### Turn 1: Understanding & Clarification
- **User:** *"Alexa, I need that little thing that lets me plug my laptop into the TV. I don't know what it's called."*
- **Behind the Scenes:** Alexa+ calls `identify_product({ description: "..." })`.
  - Veylo returns:
    - Canonical: `USB-C to HDMI adapter`
    - Confidence: `0.91`
    - Category: `video adapters`
    - Clarifying Question: `"Do you need one nearby today?"`
- **Alexa+ Speaks:** *"You probably mean a USB-C to HDMI adapter. Do you need one nearby today, or are you okay ordering online?"*

### Turn 2: Local Discovery & Honest Stock Evidence
- **User:** *"I need it nearby today."*
- **Behind the Scenes:** Alexa+ calls:
  1. `discover_local_places({ product: "USB-C to HDMI adapter", location: "Austin, TX", storeCategories: ["electronics", "computer"] })`
  2. `check_local_inventory({ storeId: "osm:node/1", product: "USB-C to HDMI adapter" })`
  - Veylo discovers nearby retailers and evaluates evidence:
    - Status: `LIKELY` (store website lists compatible adapter; shelf inventory unconfirmed)
- **Alexa+ Speaks:** *"I found Fixture Electronics about 600 meters away. Their website lists a compatible adapter, but shelf inventory is not confirmed. Would you like directions or their phone number to call ahead?"*

### Turn 3: Action Execution
- **User:** *"Show directions on screen."*
- **Behind the Scenes:** Alexa+ calls `get_directions({ placeId: "osm:node/1" })`.
- **Echo Show Display:** Presents map card, navigation route link, and quick-action buttons.

---

## 4. Alexa+ Agent Directives (System Prompt)

When configuring an Alexa+ Agent or custom skill with Veylo tools, the agent is provided these instructions:

```text
You have access to Veylo MCP tools for physical product discovery and local availability.

Rules for using Veylo tools:
1. When a user describes a physical product without knowing its name, ALWAYS invoke `identify_product` first.
2. If `identify_product` returns a clarifyingQuestion and confidence is below 0.75, ask the user the question before searching for stores.
3. If the user expresses urgency ("today", "right now", "nearby"), invoke `discover_local_places` and then `check_local_inventory` on the top result.
4. NEVER claim an item is in stock unless `check_local_inventory` returns status `CONFIRMED`.
   - If status is `LIKELY`: Explain that the store lists the product online, but shelf stock is unverified.
   - If status is `UNKNOWN`: Explain that the store is the right type of retailer (e.g. electronics or hardware store), but stock is unconfirmed. Suggest calling ahead.
5. On multimodal devices (Echo Show, Fire TV), pair voice responses with structured display cards showing store name, distance, and trust status.
```

---

## 5. MCP Tool Manifest for Alexa+ Agent Configuration

An Alexa+ agent invokes Veylo by registering its MCP tool contracts. The tools are exposed over Streamable HTTP:

```json
{
  "tools": [
    {
      "name": "identify_product",
      "description": "Identify a product from an ambiguous functional or visual description, determine confidence, alternatives, and clarifying questions.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "description": { "type": "string" },
          "visualDescription": { "type": "string" },
          "constraints": {
            "type": "object",
            "properties": {
              "location": { "type": "string" },
              "urgency": { "type": "string", "enum": ["today", "this_week", "online", "unknown"] }
            }
          }
        },
        "required": ["description"]
      }
    },
    {
      "name": "discover_local_places",
      "description": "Discover physical retail stores likely to carry the product around a geographic location.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "product": { "type": "string" },
          "location": { "type": "string" },
          "radiusMeters": { "type": "number" },
          "storeCategories": { "type": "array", "items": { "type": "string" } }
        },
        "required": ["product", "location"]
      }
    },
    {
      "name": "check_local_inventory",
      "description": "Check inventory evidence for a specific store and product, returning an honest trust state (CONFIRMED, LIKELY, WEB_FOUND, UNKNOWN).",
      "inputSchema": {
        "type": "object",
        "properties": {
          "storeId": { "type": "string" },
          "product": { "type": "string" }
        },
        "required": ["storeId", "product"]
      }
    },
    {
      "name": "compare_products",
      "description": "Compare candidate products across technical attributes, pros/cons, and recommended choice.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "products": { "type": "array", "items": { "type": "string" } }
        },
        "required": ["products"]
      }
    },
    {
      "name": "get_directions",
      "description": "Get directions and map links to a physical store.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "placeId": { "type": "string" }
        },
        "required": ["placeId"]
      }
    }
  ]
}
```

---

## 6. Echo Show 10 Multimodal Simulation

The Veylo Web UI includes a built-in **Echo Show 10 Simulation Modal**:
- **Launch:** Click **Alexa+ Preview** in the web header or the Sparkles banner.
- **Scenario Toggle:** Easily switch between **Killer Demo** (USB-C adapter), **Second Demo** (PTFE plumber's tape), and **Current Search**.
- **Interactive Voice Speech:** Unmute voice to hear spoken Alexa synthesis rendered with the browser's speech synthesis engine while the Echo Show light ring pulses in cyan.
- **Inspectable Wire:** Toggle **View MCP Wire** to inspect the raw JSON-RPC 2.0 messages passing between the agent and the server.
