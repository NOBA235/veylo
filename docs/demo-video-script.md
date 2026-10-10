# Veylo — 3-Minute Hackathon Video Submission Script

> **Track:** Alexa+ (Primary Track)  
> **Mini Challenge:** AWS Builder Mini Challenge (Amazon Bedrock)  
> **Target Video Length:** 3 minutes (180 seconds)  

---

## Visual & Audio Production Plan

| Timestamp | Visual Screen | Voiceover Script | Key Elements Displayed |
| :--- | :--- | :--- | :--- |
| **0:00 – 0:25** | Title Card / Web UI Home screen with ambient voice search bar | "When people express physical-world shopping needs to Alexa, they rarely know the product's official name. They don't say *'Search for USB-C to HDMI adapter'*. They say: *'Alexa, what's that little adapter I need to plug my laptop into the TV?'* <br><br>Existing assistants either fail or hallucinate inventory. Meet **Veylo**: *See it. Say it. Find it.* An agent capability purpose-built for Alexa+ that turns ambiguous human speech into concrete, real-world physical action." | Veylo Logo, Tagline, Alexa+ & AWS Builder Badges |
| **0:25 – 1:05** | Web Search Bar → 1-click **"connect laptop to TV"** → Agent Execution | "Watch what happens when an Alexa+ agent invokes Veylo over the Model Context Protocol. <br><br>First, Veylo generates semantic product hypotheses using Amazon Bedrock, identifying a **USB-C to HDMI adapter** with 91% confidence, while noting alternatives like USB-C hubs. <br><br>Next, Veylo maps the category to electronics stores, queries OpenStreetMap to discover real retailers nearby, and gathers web and store evidence. Notice our strict trust state: **LIKELY**. Veylo never fabricates store inventory—it explains that the store lists the item online, but shelf stock isn't confirmed, recommending the user call ahead." | Product Card, Alternatives, OSM Store Grid, Honest Evidence Badge, Directions Link |
| **1:05 – 1:45** | Click **Alexa+ Preview** in Header → Echo Show 10 Modal | "Here is the exact voice experience on an Echo Show 10. <br><br>In Turn 1, the user speaks their ambiguous need. Alexa+ invokes `identify_product` via MCP and asks: *'You probably mean a USB-C to HDMI adapter. Do you need one nearby today?'* <br><br>When the user says *'Yeah'*, Alexa+ calls `discover_local_places` and `check_local_inventory`, synthesizing: *'Fixture Electronics is 600 meters away. They have an online listing, but shelf stock isn't confirmed. Want directions?'* <br><br>We can even inspect the raw JSON-RPC wire format passing over Streamable HTTP." | Pulsating Cyan Echo Ring, Multimodal Screen Card, Voice Synthesis, MCP Wire Inspector |
| **1:45 – 2:20** | Code Walkthrough: `packages/ai/src/providers/bedrock.ts` & Terminal | "For the **AWS Builder Mini Challenge**, Amazon Bedrock is a real, load-bearing component of Veylo's AI layer. <br><br>Using the official AWS SDK and the unified `ConverseCommand`, Veylo queries Claude 3.5 Sonnet using cross-region inference profiles with an explicit `maxTokens` limit of 1024. <br><br>Every response is strictly validated against Zod schemas. And if AWS credentials aren't set, Veylo automatically falls back to deterministic rule heuristics, guaranteeing zero broken demos for hackathon evaluators." | Bedrock Code, ConverseCommand, Zod Validation, `pnpm --filter @veylo/ai test` |
| **2:20 – 2:45** | Return to UI → 1-click **"white tape plumbers use"** | "To prove Veylo isn't hardcoded around a single demo, let's try another: *'white tape plumbers use'*. <br><br>Veylo instantly infers **PTFE thread seal tape**, maps to plumbing and hardware stores, finds nearby retailers, and reports **UNKNOWN** inventory status. Zero stock was fabricated. The user can add it to their shopping list or get directions." | Second Demo Generalization, Plumbing Consumables, Hardware Store Mapping |
| **2:45 – 3:00** | Final Summary Slide & Architecture Diagram | "Veylo turns *'I don't know what this thing is called'* into *'Here's what it probably is, where you can find it, how confident we are, and what you can do next.'* <br><br>Thank you, and see you on Alexa+." | Architecture Diagram, GitHub Link, MIT License |

---

## Recording Tips for Submitter
1. Use 1080p or 4K screen recording at 60fps.
2. Enable speech audio in the Echo Show Preview so judges hear Alexa speaking the response.
3. Keep the terminal visible momentarily to show the MCP server running on port 8787 and passing tests.

