export interface ServerConfig {
  port: number;
  host: string;
  allowedOrigins: string[];
  authToken?: string;
  /** Reply with application/json instead of an SSE stream (the tools here never stream). */
  jsonResponse: boolean;
  braveApiKey?: string;
  demoMode?: boolean;
}

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

export function loadConfig(env: Record<string, string | undefined>): ServerConfig {
  const port = Number(env.MCP_PORT ?? "8787");
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`MCP_PORT is not a valid port: "${env.MCP_PORT}"`);
  const host = env.MCP_HOST?.trim() || "127.0.0.1";
  const authToken = env.MCP_AUTH_TOKEN?.trim() || undefined;
  // Binding beyond loopback without auth would expose the tools to the network.
  if (!LOOPBACK_HOSTS.has(host) && !authToken && env.MCP_ALLOW_INSECURE_PUBLIC !== "true") {
    throw new Error(`MCP_HOST=${host} is not loopback: set MCP_AUTH_TOKEN (or MCP_ALLOW_INSECURE_PUBLIC=true to override).`);
  }
  return {
    port,
    host,
    allowedOrigins: (env.MCP_ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    authToken,
    jsonResponse: env.MCP_JSON_RESPONSE !== "false",
    braveApiKey: env.BRAVE_SEARCH_API_KEY?.trim() || undefined,
    ...(env.DEMO_MODE === "true" ? { demoMode: true } : {}),
  };
}
