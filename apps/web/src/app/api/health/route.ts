import { NextResponse } from "next/server";
import { getToolCaller } from "@/lib/mcp";

export async function GET() {
  try {
    const { mode, url } = await getToolCaller();
    const provider = process.env.AI_PROVIDER || "rules";
    const demoMode = process.env.DEMO_MODE === "true";
    const bedrockModel = process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-sonnet-4-6";
    const awsRegion = process.env.AWS_REGION || "us-east-1";

    return NextResponse.json({
      status: "healthy",
      service: "Veylo Web UI",
      mcp: {
        mode,
        url,
        specVersion: "2025-11-25",
        streamableHttp: true,
      },
      ai: {
        provider,
        bedrockModel,
        awsRegion,
        hasAwsCredentials: Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
      },
      demoMode,
      trustModel: "Evidence-First (CONFIRMED | LIKELY | WEB_FOUND | UNKNOWN)",
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return NextResponse.json({
      status: "degraded",
      error: err.message,
    }, { status: 500 });
  }
}

