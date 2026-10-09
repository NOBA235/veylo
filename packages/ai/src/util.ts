import { z } from "zod";
import type { IdentifyAssistRequest, CompareAssistRequest } from "./types";

/**
 * Robust JSON extraction from LLM response.
 * Handles markdown code fences (```json ... ```), raw JSON, or text surrounding JSON.
 */
export function extractJsonFromText<T extends z.ZodTypeAny>(rawText: string, schema: T): z.output<T> {
  let text = rawText.trim();

  // Strip code fences
  if (text.startsWith("```")) {
    const lines = text.split("\n");
    if (lines[0]?.startsWith("```")) {
      lines.shift();
    }
    if (lines[lines.length - 1]?.startsWith("```")) {
      lines.pop();
    }
    text = lines.join("\n").trim();
  }

  // Find outermost JSON object
  const startIdx = text.indexOf("{");
  const endIdx = text.lastIndexOf("}");
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    throw new Error(`LLM output did not contain a valid JSON object: ${text.slice(0, 150)}`);
  }

  const jsonStr = text.slice(startIdx, endIdx + 1);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    throw new Error(`Failed to parse JSON from LLM output: ${String(err)}. Raw: ${jsonStr.slice(0, 150)}`);
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".") || "root"}: ${i.message}`).join(", ");
    throw new Error(`LLM JSON output failed schema validation: ${issues}`);
  }

  return result.data as z.output<T>;
}

export function buildIdentifyPrompt(req: IdentifyAssistRequest): { system: string; user: string } {
  const system = `You are Veylo's Product Identification Engine.
Your job is to identify the real-world physical product a person is trying to find when they don't know its exact name or category.

Rules:
1. Identify the single most likely canonical product name.
2. If the user's intent matches a product in the catalogue shortlist, favor that exact canonical name.
3. If the user's description is genuinely ambiguous between multiple distinct connectors, products, or form factors, formulate a concise, empathetic clarifyingQuestion to help them decide.
4. Output STRICT JSON adhering to this schema:
{
  "product": "canonical product name",
  "category": "one of the allowed categories",
  "confidence": 0.0 to 1.0,
  "reasoning": "brief explanation connecting the user's description to the product",
  "alternatives": ["alternative product 1", "alternative product 2"],
  "uncertainty": "known points of confusion or compatibility notes",
  "clarifyingQuestion": "optional clarification question if ambiguous"
}`;

  const user = `User request:
- Description: "${req.description}"
${req.visualDescription ? `- Visual Description: "${req.visualDescription}"` : ""}
${req.constraints?.compatibility ? `- Stated Compatibility: "${req.constraints.compatibility}"` : ""}
${req.constraints?.urgency ? `- Urgency: "${req.constraints.urgency}"` : ""}
${req.constraints?.budget ? `- Budget: "${req.constraints.budget}"` : ""}

Catalogue Shortlist (Top Rules Candidates):
${req.shortlist.map((s, i) => `${i + 1}. ${s.name} [${s.category}] (score: ${s.score}) - ${s.description}`).join("\n")}

Allowed Categories:
${req.categories.join(", ")}

Respond with STRICT JSON only.`;

  return { system, user };
}

export function buildComparePrompt(req: CompareAssistRequest): { system: string; user: string } {
  const system = `You are Veylo's Product Comparison Engine.
Your job is to compare candidate products and recommend the best fit for the user's requirements.

CRITICAL RULES:
1. NEVER fabricate availability, shelf stock, or distances. Availability states (CONFIRMED, LIKELY, WEB_FOUND, UNKNOWN) and distances are fixed ground truth.
2. Evaluate pros and cons based strictly on product specifications, attributes, compatibility, and availability.
3. Provide a clear, actionable recommendation.
4. Output STRICT JSON adhering to this schema:
{
  "recommendation": "string recommending the best candidate and why",
  "reasoningSummary": "string summarizing the key trade-offs",
  "notes": [
    {
      "product": "product name exactly matching one of the candidate products",
      "pros": ["pro 1", "pro 2"],
      "cons": ["con 1", "con 2"]
    }
  ]
}`;

  const user = `Candidate Products to Compare:
${req.products
  .map(
    (p, i) => `${i + 1}. ${p.name}
   Category: ${p.category}
   Description: ${p.description}
   Compatibility: ${p.compatibility.join("; ") || "None specified"}
   Attributes: ${JSON.stringify(p.attributes)}
   Current Stock State: ${p.availability}
   Distance: ${p.distanceMeters !== undefined ? `${p.distanceMeters}m` : "Unknown"}`
  )
  .join("\n\n")}

${req.requirements ? `User Requirements: ${JSON.stringify(req.requirements)}` : ""}
${req.location ? `User Location: ${req.location}` : ""}

Respond with STRICT JSON only.`;

  return { system, user };
}
