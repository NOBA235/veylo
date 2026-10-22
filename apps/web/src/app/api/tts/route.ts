import { PollyClient, SynthesizeSpeechCommand, type Engine, type VoiceId } from "@aws-sdk/client-polly";
import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

// Default to Amazon Polly Neural "Joanna" (Alexa voice persona)
const DEFAULT_VOICE_ID: VoiceId = "Joanna";
const DEFAULT_ENGINE: Engine = "neural";

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

function hasAwsCredentials(): boolean {
  return Boolean(
    getEnvVar("AWS_ACCESS_KEY_ID") ||
    getEnvVar("AWS_SECRET_ACCESS_KEY") ||
    getEnvVar("AWS_PROFILE") ||
    process.env.AWS_ACCESS_KEY_ID ||
    process.env.AWS_SECRET_ACCESS_KEY ||
    process.env.AWS_PROFILE ||
    process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI ||
    process.env.AWS_WEB_IDENTITY_TOKEN_FILE
  );
}

let pollyClient: PollyClient | null = null;

function getPolly(): PollyClient {
  if (!pollyClient) {
    const region = getEnvVar("AWS_REGION") || process.env.AWS_REGION || "us-east-1";
    pollyClient = new PollyClient({
      region,
      maxAttempts: 3,
    });
  }
  return pollyClient;
}

export async function POST(req: Request) {
  try {
    if (!hasAwsCredentials()) {
      return NextResponse.json(
        {
          error: "AWS credentials are not configured for Amazon Polly",
          code: "NOT_CONFIGURED",
        },
        { status: 501 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const voiceId = (body?.voiceId || getEnvVar("POLLY_VOICE_ID") || DEFAULT_VOICE_ID) as VoiceId;
    const engine = (body?.engine || getEnvVar("POLLY_ENGINE") || DEFAULT_ENGINE) as Engine;

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

    const polly = getPolly();
    const command = new SynthesizeSpeechCommand({
      Text: cleanText,
      OutputFormat: "mp3",
      VoiceId: voiceId,
      Engine: engine,
    });

    const response = await polly.send(command);

    if (!response.AudioStream) {
      return NextResponse.json(
        { error: "Amazon Polly returned an empty audio stream" },
        { status: 502 }
      );
    }

    // Convert stream to byte array using standard AWS SDK v3 stream transform
    let audioBuffer: Uint8Array;
    const stream = response.AudioStream as { transformToByteArray?: () => Promise<Uint8Array> };
    if (typeof stream.transformToByteArray === "function") {
      audioBuffer = await stream.transformToByteArray();
    } else {
      // Fallback for Node Readable stream
      const chunks: Buffer[] = [];
      for await (const chunk of response.AudioStream as unknown as AsyncIterable<Buffer | Uint8Array>) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      audioBuffer = Buffer.concat(chunks);
    }

    const arrayBuffer = audioBuffer.buffer.slice(
      audioBuffer.byteOffset,
      audioBuffer.byteOffset + audioBuffer.byteLength
    );

    return new Response(arrayBuffer as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.byteLength.toString(),
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[Amazon Polly TTS Error]", err);

    // If AWS credentials or permissions failed, return 501 so the UI gracefully falls back to browser voice
    const isAuthError =
      err.name === "CredentialsProviderError" ||
      err.name === "UnrecognizedClientException" ||
      err.name === "AccessDeniedException" ||
      err.name === "ExpiredTokenException" ||
      err.message.includes("credentials");

    return NextResponse.json(
      {
        error: err.message || "Failed to generate Amazon Polly speech",
        code: isAuthError ? "NOT_CONFIGURED" : "TTS_ERROR",
      },
      { status: isAuthError ? 501 : 500 }
    );
  }
}
