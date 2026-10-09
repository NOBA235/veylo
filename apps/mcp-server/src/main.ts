import "./env";
import { SUPPORTED_PROTOCOL_VERSIONS } from "@modelcontextprotocol/sdk/types.js";
import { consoleLogger } from "@veylo/core";
import { resolveProviderName } from "@veylo/ai";
import { loadConfig } from "./config";
import { buildContext } from "./context";
import { createApp } from "./http";
import { createMcpServer } from "./server";
import { assertSpecSupport, REQUIRED_PROTOCOL_VERSION, SERVER_NAME, SERVER_VERSION } from "./spec";

// Fail at startup (not on the first request) if the installed SDK cannot speak the documented spec revision.
assertSpecSupport(SUPPORTED_PROTOCOL_VERSIONS);

const config = loadConfig(process.env);
const { handlers, close } = buildContext(config);

const provider = resolveProviderName();
if (provider !== "rules") {
  consoleLogger.warn(`AI_PROVIDER=${provider} is set, but AI providers arrive in Phase 5/6; identification uses rules.`);
}

const app = createApp({
  createServer: () => createMcpServer(handlers),
  guard: { allowedOrigins: config.allowedOrigins, authToken: config.authToken },
  jsonResponse: config.jsonResponse,
  logger: consoleLogger,
});

const server = app.listen(config.port, config.host, () => {
  consoleLogger.info(`${SERVER_NAME} ${SERVER_VERSION} MCP server (spec ${REQUIRED_PROTOCOL_VERSION}, Streamable HTTP) listening`, {
    url: `http://${config.host}:${config.port}/mcp`,
    auth: config.authToken ? "bearer token required" : "none (loopback only)",
    webSearch: config.braveApiKey ? "enabled" : "not configured",
  });
});

const shutdown = () => {
  server.close(() => void close().finally(() => process.exit(0)));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
