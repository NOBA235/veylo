import { NextResponse } from "next/server";
import { runAgent, type AgentInput, type AgentState } from "@veylo/agent";
import { getToolCaller } from "@/lib/mcp";

export async function POST(req: Request) {
  try {
    const isSseRequested =
      req.headers.get("accept")?.includes("text/event-stream") ||
      req.headers.get("x-stream") === "true";

    const body = await req.json();
    const {
      message,
      answer,
      userId = "default",
      location,
      urgency,
      compatibility,
      budget,
      requirements,
      radiusMeters,
      state,
      maxSteps,
      stream: requestedStream,
    } = body as {
      message?: string;
      answer?: string;
      userId?: string;
      location?: string;
      urgency?: "today" | "this_week" | "online" | "unknown";
      compatibility?: string;
      budget?: string;
      requirements?: Record<string, unknown>;
      radiusMeters?: number;
      state?: AgentState;
      maxSteps?: number;
      stream?: boolean;
    };

    const agentInput: AgentInput = {
      message,
      answer,
      userId,
      location,
      urgency,
      compatibility,
      budget,
      requirements,
      radiusMeters,
    };

    const { caller, mode, url } = await getToolCaller();
    const shouldStream = isSseRequested || requestedStream === true;

    // Progressive Agent Trace (SSE Streaming): Section 37.1
    if (shouldStream) {
      const responseStream = new TransformStream();
      const writer = responseStream.writable.getWriter();
      const encoder = new TextEncoder();

      const send = async (event: string, data: unknown) => {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        await writer.write(encoder.encode(payload));
      };

      (async () => {
        try {
          const result = await runAgent(caller, agentInput, {
            state,
            maxSteps,
            onStep: async (step) => {
              await send("step", step);
            },
          });

          await send("done", {
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
          console.error("[API /api/agent SSE] Error:", err);
          await send("error", {
            ok: false,
            error: err.message || "Agent execution failed",
          });
        } finally {
          await writer.close();
        }
      })();

      return new Response(responseStream.readable, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
        },
      });
    }

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

