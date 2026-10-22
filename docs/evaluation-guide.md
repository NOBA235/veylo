# Veylo Evaluation & Walkthrough Guide

This guide walks evaluators, partners, and developers through testing Veylo's end-to-end capabilities: turning ambiguous physical requests into concrete real-world actions over the Model Context Protocol (MCP).

---

## 1. Quick Environment Setup

1. **Start the MCP Server:**
   ```bash
   pnpm mcp:dev
   ```
   *Runs on `http://127.0.0.1:8787/mcp` using Streamable HTTP (MCP spec 2025-11-25).*

2. **Start the Web Application:**
   ```bash
   pnpm dev
   ```
   *Runs on `http://localhost:3000` (Next.js 15, React 19).*

3. **Verify Health:**
   Visit `http://localhost:3000` and observe the header telemetry:
   - **MCP Status:** `MCP 2025-11-25 • Streamable HTTP`
   - **AI Provider:** `BEDROCK` (Amazon Bedrock Converse API) or deterministic offline `RULES`
   - **Trust Policy:** `Zero Hallucinated Stock`

---

## 2. Core Evaluation Scenarios

### Scenario A: Resolving Ambiguous Hardware Inquiries

**User Input:**
> *"I need that little thing that lets me connect my laptop to a TV. I don't know what it's called."*

**What to Observe:**
1. **Real-Time Progressive Trace (SSE Streaming):**
   - Each MCP tool call appears dynamically in the UI as the agent reasons (`identify_product` → `get_user_context` → `discover_local_places` → `check_local_inventory` → `compare_products`).
   - Notice step number, tool input/output summaries, confidence change, and evidence counts update live.
2. **Hardware Compatibility Deduction:**
   - The agent queries `get_user_context` and detects the registered MacBook Pro (M3), deducing **USB-C** connector compatibility automatically.
3. **Redundant Purchase Prevention:**
   - The user inventory memory alert triggers: *"Note: You already own a USB-C to HDMI adapter (acquired 2024-02-15) in your user inventory. Do you need a second one?"*
4. **Local Availability & Honest Evidence:**
   - Nearby electronics stores are discovered via OpenStreetMap geodata.
   - Availability is tagged honestly (`LIKELY` or `CONFIRMED` only when verified).

---

### Scenario B: Colloquial Trade Names & Functional Synonyms

**User Input:**
> *"I need the white tape plumbers use around pipe threads."*

**What to Observe:**
1. **Identification Engine:**
   - Maps the colloquial description directly to canonical **PTFE thread seal tape** (Teflon tape) with >90% confidence.
2. **Store Category Mapping:**
   - Instead of searching electronics retailers, Veylo dynamically maps plumbing supplies to local hardware stores, home centers, and plumbing supply houses.
3. **Trade-Off Matrix:**
   - Displays functional alternatives (e.g., standard PTFE vs high-density gas line tape vs pipe thread sealant paste).

---

### Scenario C: Conversational Clarification & Urgency

**User Input:**
> *"I need a cable to charge my phone."*

**What to Observe:**
1. **Ambiguity Gate:**
   - Because multiple incompatible standards exist (USB-C vs Lightning), the planner refrains from searching blind and surfaces an inline clarification card:
     > *"What type of phone or connector do you need to charge?"*
2. **Interactive Answer:**
   - Select an alternative or enter "iPhone 15" $\rightarrow$ the agent immediately resumes planning with USB-C and finishes execution within the 8-step budget.

---

## 3. Protocol & Tool Verification

### Official MCP Inspector
To interact with Veylo's MCP server directly using the official Model Context Protocol Inspector:
```bash
npx @modelcontextprotocol/inspector http://127.0.0.1:8787/mcp
```
You can list all 11 registered tools, review their JSON schemas, and trigger sample calls over Streamable HTTP.

### Automated Conformance Suite
Verify full protocol compliance:
```bash
pnpm mcp:conformance
```
Checks:
- Protocol version negotiation (`2025-11-25`)
- Strict tool schema alignment
- Error boundary handling & CORS origin protections
- Streamable HTTP stateless endpoint compliance

---

## 4. Voice & Ambient Multimodal Simulation

Click **Alexa+ Preview** in the top navigation bar to open the interactive **Echo Show 10** simulation:
- Visual display of how ambient multimodal devices render Veylo's responses.
- Simulated multi-turn voice dialog using Web Speech API synthesis.
- Explains the exact MCP tool invocations that occur behind the ambient voice experience.
