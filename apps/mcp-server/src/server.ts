// MCP server construction with the official TypeScript SDK. Kept thin: every tool is registered from the
// contract registry and delegates to the SDK-free executor in @veylo/core.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SUPPORTED_PROTOCOL_VERSIONS, type CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolHandlers } from "@veylo/core";
import { TOOL_NAMES, toolContracts } from "@veylo/types";
import { inputShape, outputShape } from "./schema-shapes";
import { assertSpecSupport, SERVER_INSTRUCTIONS, SERVER_NAME, SERVER_VERSION } from "./spec";
import { TOOL_META } from "./tool-meta";

export function createMcpServer(handlers: ToolHandlers): McpServer {
  assertSpecSupport(SUPPORTED_PROTOCOL_VERSIONS);
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION }, { instructions: SERVER_INSTRUCTIONS });
  for (const name of TOOL_NAMES) {
    server.registerTool(
      name,
      {
        title: TOOL_META[name].title,
        description: toolContracts[name].description,
        inputSchema: inputShape(name),
        outputSchema: outputShape(name),
        annotations: TOOL_META[name].annotations,
      },
      async (args: unknown): Promise<CallToolResult> => (await handlers[name](args)) as CallToolResult,
    );
  }
  return server;
}
