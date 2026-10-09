import { NextResponse } from "next/server";
import { runAgent, type AgentInput, type AgentState } from "@veylo/agent";
import { getToolCaller } from "@/lib/mcp";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, answer, location, urgency, compatibility, budget, requirements, radiusMeters, state, maxSteps } = body as {
      message?: string;
      answer?: string;
      location?: string;
      urgency?: "today" | "this_week" | "online" | "unknown";
      compatibility?: string;
      budget?: string;
      requirements?: Record<string, unknown>;
      radiusMeters?: number;
      state?: AgentState;
      maxSteps?: number;
    };

    const agentInput: AgentInput = {
      message,
      answer,
      location,
      urgency,
      compatibility,
      budget,
      requirements,
      radiusMeters,
    };

    const { caller, mode, url } = await getToolCaller();
    const result = await runAgent(caller, agentInput, { state, maxSteps });

    return NextResponse.json({
      ok: true,
      result,
      mcp: {
        mode,
        url,
        specVersion: "2025-11-25",
      },
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[API /api/agent] Error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err.message || "Internal server error while executing agent loop",
      },
      { status: 500 }
    );
  }
}

