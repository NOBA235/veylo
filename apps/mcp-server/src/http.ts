// Streamable HTTP transport (MCP spec 2025-11-25) over Express, in the SDK's stateless mode:
// a fresh server + transport per POST. The tools are request/response, so no session state is needed.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Logger } from "@veylo/core";
import { TOOL_NAMES } from "@veylo/types";
import express, { type NextFunction, type Request, type Response } from "express";
import { checkRequest, type GuardConfig } from "./guard";
import { REQUIRED_PROTOCOL_VERSION, SERVER_NAME, SERVER_VERSION } from "./spec";

export interface AppOptions {
  createServer: () => McpServer;
  guard: GuardConfig;
  jsonResponse: boolean;
  logger: Logger;
}

const rpcError = (res: Response, status: number, message: string, code = -32000) =>
  res.status(status).json({ jsonrpc: "2.0", error: { code, message }, id: null });

export function createApp(opts: AppOptions): express.Express {
  const app = express();
  app.disable("x-powered-by");

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true, name: SERVER_NAME, version: SERVER_VERSION, protocolVersion: REQUIRED_PROTOCOL_VERSION, tools: TOOL_NAMES.length });
  });

  app.use("/mcp", (req: Request, res: Response, next: NextFunction) => {
    const verdict = checkRequest({ origin: req.headers.origin, authorization: req.headers.authorization }, opts.guard);
    if (verdict.ok) next();
    else rpcError(res, verdict.status, verdict.message);
  });
  app.use("/mcp", express.json({ limit: "1mb" }));

  app.post("/mcp", async (req: Request, res: Response) => {
    const server = opts.createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: opts.jsonResponse });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      opts.logger.warn("MCP request failed", { reason: String(err) });
      if (!res.headersSent) rpcError(res, 500, "Internal server error", -32603);
    }
  });

  const methodNotAllowed = (_req: Request, res: Response) => {
    res.setHeader("Allow", "POST");
    rpcError(res, 405, "Method not allowed: this server is stateless, use POST.");
  };
  app.get("/mcp", methodNotAllowed);
  app.delete("/mcp", methodNotAllowed);

  // Malformed JSON bodies become a JSON-RPC parse error instead of an HTML stack trace.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    opts.logger.warn("bad request", { reason: String(err) });
    rpcError(res, 400, "Parse error", -32700);
  });
  return app;
}
