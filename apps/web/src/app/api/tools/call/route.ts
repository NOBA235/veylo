import { NextResponse } from "next/server";
import { getToolCaller } from "@/lib/mcp";
import type { ToolName } from "@veylo/types";

export async function POST(req: Request) {
  try {
    const { name, input } = (await req.json()) as { name: ToolName; input: unknown };
    if (!name) {
      return NextResponse.json({ ok: false, error: "Tool name is required" }, { status: 400 });
    }

    const { caller, mode, url } = await getToolCaller();
    // caller.call validates against the tool's schema internally
    const result = await caller.call(name, input as never);

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
    const err = error as { message?: string; code?: string };
    console.error("[API /api/tools/call] Error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: err.message || "Failed to execute tool",
        code: err.code,
      },
      { status: 500 }
    );
  }
}

