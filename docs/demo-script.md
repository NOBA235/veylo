# Veylo — Master Hackathon Demo Script

> **Target Track:** Alexa+ (Primary Track)  
> **Mini Challenge:** AWS Builder Mini Challenge (Amazon Bedrock)  
> **Duration:** 5–7 minutes live walkthrough (or 3-minute video)  

---

## 1. Demo Setup & Readiness Checklist

1. **Start Server & Web App:**
   ```bash
   # Terminal 1: MCP Server (port 8787)
   pnpm --filter @veylo/mcp-server start

   # Terminal 2: Web UI (port 3000)
   pnpm --filter @veylo/web dev
   ```
2. **Open Browser:** Navigate to `http://localhost:3000`.
3. **Verify Header Badges:**
   - `MCP 2025-11-25 • Streamable HTTP` (green indicator)
   - `AI: BEDROCK` (or `AI: RULES` if running offline)
   - `Zero Hallucinated Stock` (shield badge)

---

## 2. Act 1: The Killer Demo — Ambiguity to Real-World Action

### The Problem
People don't naturally say: *"Search for USB-C to HDMI adapter."*  
They say: *"I need that little thing that lets me connect my laptop to the TV. I don't know what it's called."*

### Step-by-Step Walkthrough
1. **Trigger Search:**
   - In the search bar on `http://localhost:3000`, click the 1-click prompt:
     > **"connect laptop to TV"**
   - Click **Find Product**.
2. **Watch the Agent Progress Bar:**
   - `UNDERSTAND` → `IDENTIFY` → `DISCOVER` → `EVALUATE` → `ACTION`
3. **Inspect the Result:**
   - **Identified Product Card:** Shows **USB-C to HDMI adapter** with high confidence (~91%), canonical category `video adapters`, and functional alternatives (`USB-C Hub with HDMI`, `USB-C to HDMI cable`).
   - **Local Stores Grid:** Displays nearby electronics and computer retailers discovered from OpenStreetMap (e.g. *Fixture Electronics* at 0.55 km).
   - **Honest Evidence Badge:** Shows `LIKELY` (with explanation: *"Online product listing found; shelf stock not shown"*).
   - **Next Action Recommendation:** Shows *"Call Fixture Electronics on +1 512 555 0100 to confirm current stock before travelling."*
4. **Take Action:**
   - Click **Get Directions**: Modal displays navigation details and Google Maps launch link.
   - Click **Add to Shopping List**: Saves item into session list.

---

## 3. Act 2: Echo Show 10 • Alexa+ Voice Experience Simulation

1. **Launch Voice Preview:**
   - Click the **Alexa+ Preview** button in the header.
2. **Interactive Multimodal Experience:**
   - Select the **Killer Demo** scenario tab.
   - Click **Unmute Voice** (top right) to enable voice audio.
   - Click **Play Voice** on Turn 2 and Turn 3 to hear spoken Alexa synthesis.
3. **Observe Turn-by-Turn Flow:**
   - **Turn 1 (Ambiguity & Identification):** User asks ambiguous question → Alexa+ invokes `identify_product()` over MCP.
   - **Turn 2 (Clarification & Discovery):** Alexa+ asks: *"Do you need one nearby today?"* → User answers: *"Yeah"* → Alexa+ calls `discover_local_places()` and `check_local_inventory()`.
   - **Turn 3 (Honest Synthesis):** Alexa+ speaks: *"I found Fixture Electronics 600m away. They have an online listing, but shelf stock isn't verified. Want directions or their phone number?"*
4. **Inspect MCP Wire:**
   - Click **View MCP Wire** to reveal the exact JSON-RPC 2.0 payload sent over Streamable HTTP.

---

## 4. Act 3: Proving Generalization (Second Demo)

To prove Veylo is not hardcoded around a single cable or adapter:

1. **Trigger Second Demo:**
   - Click the 1-click prompt button:
     > **"white tape plumbers use"**
   - Click **Find Product**.
2. **Observe Dynamic Generalization:**
   - Veylo identifies: **PTFE thread seal tape** (canonical category: `plumbing consumables`).
   - Category mapping automatically resolves to `hardware`, `plumbing_supplies`, and `doityourself` store types.
   - Real local places show hardware stores (*Fixture Hardware*).
   - **Evidence Trust State:** Reports `UNKNOWN` (confidence 0.25) because the store is the right retailer type, but zero product stock was fabricated.

---

## 5. Act 4: AWS Builder Mini Challenge Integration (Amazon Bedrock)

1. **Bedrock AI Provider Verification:**
   - Open `.env` and set `AI_PROVIDER=bedrock`.
   - Show that Veylo connects to Amazon Bedrock via `@aws-sdk/client-bedrock-runtime` using `BedrockRuntimeClient` and `ConverseCommand`.
   - Model ID: `us.anthropic.claude-sonnet-4-6` with explicit `maxTokens: 1024`.
2. **Zero-Breakage Offline Fallback:**
   - Change `AI_PROVIDER=rules` or remove AWS keys.
   - Rerun the search: Veylo executes without crashing, using the deterministic seed catalog and rule-based heuristics.
   - Point judges to [`docs/aws-builder-integration.md`](aws-builder-integration.md) for full architecture and test coverage.

---

## 6. Act 5: Real MCP Server Verification (MCP Inspector)

1. **Launch MCP Inspector:**
   ```bash
   npx @modelcontextprotocol/inspector
   ```
2. **Connect to Veylo:**
   - Transport: **Streamable HTTP**
   - URL: `http://127.0.0.1:8787/mcp`
3. **Demonstrate Composable Tools:**
   - Call `tools/list`: Shows all 10 tools (`identify_product`, `discover_local_places`, `check_local_inventory`, `compare_products`, etc.).
   - Call `identify_product`: Returns Zod-validated JSON with confidence score and alternatives.

---

## 7. Act 6: Inspectable Agent Trace

1. **Open Trace Drawer:**
   - Click **Agent Trace** in the top navigation bar.
2. **Inspect Planner Execution:**
   - Shows the step-by-step bounded planner (max 8 steps).
   - Shows tool call inputs and structured outputs.
   - Shows confidence progression over time.
   - **Security / Honesty Check:** Notice that internal chain-of-thought is never leaked; only verifiable agent decisions and actions are logged.
