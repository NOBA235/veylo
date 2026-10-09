import { VeyloMcpClient } from "@veylo/mcp-client";
import { createLoopbackCaller, createToolExecutor, createCoreServices, type ToolCaller } from "@veylo/core";
import { createAiAssists } from "@veylo/ai";
import { makeCtx } from "@veylo/core/testing";

export type McpConnectionMode = "streamable-http" | "loopback-fallback";

export interface McpCallerInfo {
  caller: ToolCaller;
  mode: McpConnectionMode;
  url: string;
}

export async function getToolCaller(): Promise<McpCallerInfo> {
  const url = process.env.MCP_SERVER_URL ?? "http://127.0.0.1:8787/mcp";
  const token = process.env.MCP_AUTH_TOKEN;

  try {
    const client = await VeyloMcpClient.connect({
      url,
      token,
      clientName: "veylo-web",
    });
    // Verify connection by listing tools
    await client.listTools();
    return { caller: client, mode: "streamable-http", url };
  } catch (err) {
    // Graceful fallback to verified in-process loopback MCP executor so UI demo is always reliable
    console.warn(`[Veylo Web] Remote MCP server at ${url} unreachable (${String(err)}). Using in-process MCP loopback executor.`);
    const ai = createAiAssists();
    const ctx = makeCtx({
      identifyAssist: ai.identifyAssist,
      compareAssist: ai.compareAssist,
      evidenceProviders: [
        {
          name: "demo web listing",
          lookup: async ({ place, product }) =>
            place.id === "osm:node/1" && product === "USB-C to HDMI adapter"
              ? [
                  {
                    kind: "product_listed",
                    source: "store website",
                    sourceType: "web",
                    timestamp: new Date().toISOString(),
                    confidence: 0.72,
                    firstParty: true,
                    summary: "Online product listing found; shelf stock not shown.",
                  },
                ]
              : [],
        },
      ],
      clock: () => new Date(),
    });
    const caller = createLoopbackCaller(createToolExecutor(createCoreServices(ctx), ctx.logger));
    return { caller, mode: "loopback-fallback", url };
  }
}

