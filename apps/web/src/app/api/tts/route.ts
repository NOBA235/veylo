import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

// Default to "Rachel" if voiceId is not specified
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
const DEFAULT_MODEL_ID = "eleven_turbo_v2_5";

function getEnvVar(key: string): string | undefined {
  // Always check disk first in dev so modifying .env updates instantly without restart
  const candidatePaths = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../../.env"),
    path.resolve(process.cwd(), "../.env"),
  ];

  for (const envPath of candidatePaths) {
    try {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf-8");
        const regex = new RegExp(`^${key}=(.*)$`, "m");
        const match = content.match(regex);
        if (match && match[1] !== undefined) {
          const val = match[1].trim().replace(/^["']|["']$/g, "");
          if (val) {
            process.env[key] = val;
            return val;
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return process.env[key] || undefined;
}

export async function POST(req: Request) {
  try {
    const apiKey = getEnvVar("ELEVENLABS_API_KEY");
    if (!apiKey) {
      return NextResponse.json(
        {
          error: "ELEVENLABS_API_KEY is not configured",
          code: "NOT_CONFIGURED",
        },
        { status: 501 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const voiceId =
      body?.voiceId ||
      getEnvVar("ELEVENLABS_VOICE_ID") ||
      DEFAULT_VOICE_ID;
    const modelId =
      getEnvVar("ELEVENLABS_MODEL_ID") ||
      DEFAULT_MODEL_ID;

    if (!text) {
      return NextResponse.json(
        { error: "Text parameter is required" },
        { status: 400 }
      );
    }

    // Clean markdown formatting before speaking so speech sounds natural
    const cleanText = text
      .replace(/[*#`_~]/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .slice(0, 1500); // Guard max length for latency

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: modelId,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => "Unknown error");
      console.error("[ElevenLabs TTS Error]", response.status, errText);
      return NextResponse.json(
        {
          error: `ElevenLabs TTS upstream error (${response.status})`,
          detail: errText,
        },
        { status: response.status >= 500 ? 502 : response.status }
      );
    }

    const audioBuffer = await response.arrayBuffer();

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.byteLength.toString(),
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[TTS Route Exception]", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate speech" },
      { status: 500 }
    );
  }
}
