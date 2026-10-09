// Typed MCP client: the only way the web app and the agent reach Veylo's capabilities.
// Results are decoded and validated against the Zod contracts by @veylo/core's decodeToolResult.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { decodeToolResult, type ToolCaller, type ToolInput, type ToolOutput, type ToolResult } from "@veylo/core";
import type { ToolName } from "@veylo/types";

export interface ConnectOptions {
  url: string;
  /** Sent as `Authorization: Bearer <token>` when the server requires one. */
  token?: string;
  clientName?: string;
}

export class VeyloMcpClient implements ToolCaller {
  private constructor(private readonly client: Client) {}

  static async connect(options: ConnectOptions): Promise<VeyloMcpClient> {
    const transport = new StreamableHTTPClientTransport(new URL(options.url), {
      requestInit: options.token ? { headers: { Authorization: `Bearer ${options.token}` } } : undefined,
    });
    const client = new Client({ name: options.clientName ?? "veylo-client", version: "0.1.0" });
    await client.connect(transport);
    return new VeyloMcpClient(client);
  }

  async listTools() {
    return (await this.client.listTools()).tools;
  }

  /** Throws ToolCallError (with `code`) when the tool reports an error. */
  async call<N extends ToolName>(name: N, input: ToolInput<N>): Promise<ToolOutput<N>> {
    const result = await this.client.callTool({ name, arguments: input as Record<string, unknown> });
    return decodeToolResult(name, result as unknown as ToolResult);
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
