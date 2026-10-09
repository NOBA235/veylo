// A deliberately SDK-free MCP client: raw JSON-RPC over HTTP. It checks the server's wire behaviour
// independently of the SDK the server is built on. Run: pnpm --filter @veylo/mcp-server conformance [url]
import { TOOL_NAMES, toolContracts, type ToolName } from "@veylo/types";
import { REQUIRED_PROTOCOL_VERSION } from "./spec";

export interface CheckResult {
  name: string;
  ok: boolean;
  detail?: string;
}
export interface ConformanceOptions {
  token?: string;
  fetchFn?: typeof fetch;
}

interface RpcMessage {
  jsonrpc?: string;
  id?: number | string | null;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
}

/** Parses a Streamable HTTP response body: plain JSON, or an SSE stream carrying JSON-RPC messages. */
export function parseRpcBody(contentType: string | null, text: string): RpcMessage | undefined {
  if (!text.trim()) return undefined;
  if (!(contentType ?? "").includes("text/event-stream")) return JSON.parse(text) as RpcMessage;
  for (const event of text.split(/\r?\n\r?\n/)) {
    const data = event
      .split(/\r?\n/)
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trimStart())
      .join("\n");
    if (!data) continue;
    const msg = JSON.parse(data) as RpcMessage;
    if (msg.result !== undefined || msg.error !== undefined) return msg;
  }
  return undefined;
}

export const SAMPLE_ARGS: Record<ToolName, Record<string, unknown>> = {
  identify_product: { description: "pen drive" },
  search_products: { query: "plumber's tape", limit: 2 },
  discover_local_places: { product: "PTFE tape", location: "30.2672,-97.7431" },
  check_local_inventory: { storeId: "conformance-unknown-store", product: "PTFE tape" },
  compare_products: { products: ["USB-C to HDMI adapter", "USB-C hub with HDMI"] },
  get_place_details: { placeId: "conformance-unknown-place" },
  get_directions: { placeId: "conformance-unknown-place" },
  contact_store: { storeId: "conformance-unknown-store" },
  search_web: { query: "usb c hdmi adapter", limit: 1 },
  create_shopping_list: { items: [{ product: "PTFE tape", quantity: 1 }] },
};
/** Errors a healthy server may return for the sample calls above (unknown ids, optional integrations). */
const EXPECTED_ERROR_CODES = new Set(["NOT_FOUND", "NOT_CONFIGURED", "UPSTREAM_UNAVAILABLE", "GEOCODE_FAILED", "UNKNOWN_CATEGORY"]);

const errorCodeOf = (result: Record<string, unknown>): string | undefined =>
  ((result._meta as Record<string, { code?: string }> | undefined)?.["veylo/error"])?.code;

export async function runConformance(url: string, opts: ConformanceOptions = {}): Promise<CheckResult[]> {
  const fetchFn = opts.fetchFn ?? fetch;
  const results: CheckResult[] = [];
  let nextId = 1;
  let negotiated: string | undefined;

  const headers = (extra: Record<string, string> = {}): Record<string, string> => ({
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    ...(negotiated ? { "MCP-Protocol-Version": negotiated } : {}),
    ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    ...extra,
  });
  const rpc = async (method: string, params?: unknown, extra: Record<string, string> = {}) => {
    const res = await fetchFn(url, {
      method: "POST",
      headers: headers(extra),
      body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, ...(params !== undefined ? { params } : {}) }),
    });
    const text = await res.text();
    return { status: res.status, message: parseRpcBody(res.headers.get("content-type"), text) };
  };
  const check = async (name: string, fn: () => Promise<string | void>) => {
    try {
      results.push({ name, ok: true, detail: (await fn()) || undefined });
    } catch (err) {
      results.push({ name, ok: false, detail: err instanceof Error ? err.message : String(err) });
    }
  };
  const expect = (cond: unknown, msg: string) => {
    if (!cond) throw new Error(msg);
  };

  await check(`initialize negotiates MCP ${REQUIRED_PROTOCOL_VERSION}`, async () => {
    const { status, message } = await rpc("initialize", {
      protocolVersion: REQUIRED_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "veylo-conformance", version: "0.1.0" },
    });
    expect(status === 200, `HTTP ${status}`);
    const r = message?.result as { protocolVersion?: string; serverInfo?: { name?: string }; capabilities?: { tools?: unknown } } | undefined;
    expect(r, `no result: ${JSON.stringify(message?.error)}`);
    expect(r?.protocolVersion === REQUIRED_PROTOCOL_VERSION, `server answered protocolVersion ${r?.protocolVersion}`);
    expect(r?.serverInfo?.name === "veylo", `serverInfo.name was ${r?.serverInfo?.name}`);
    expect(r?.capabilities?.tools !== undefined, "capabilities.tools missing");
    negotiated = r?.protocolVersion;
  });

  await check("notifications/initialized is accepted", async () => {
    const res = await fetchFn(url, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    });
    await res.text();
    expect([200, 202, 204].includes(res.status), `HTTP ${res.status}`);
  });

  await check("tools/list returns exactly the contract tools with schemas", async () => {
    const { message } = await rpc("tools/list");
    const tools = (message?.result?.tools ?? []) as Array<{ name: string; description?: string; inputSchema?: { type?: string }; outputSchema?: unknown }>;
    const names = tools.map((t) => t.name).sort();
    expect(JSON.stringify(names) === JSON.stringify([...TOOL_NAMES].sort()), `tools were [${names.join(", ")}]`);
    for (const t of tools) {
      expect(t.description, `${t.name} has no description`);
      expect(t.inputSchema?.type === "object", `${t.name} inputSchema is not an object schema`);
      expect(t.outputSchema, `${t.name} has no outputSchema`);
    }
    return `${tools.length} tools`;
  });

  await check("every tool can be called with valid sample input without a protocol or internal error", async () => {
    const notes: string[] = [];
    for (const name of TOOL_NAMES) {
      const { message } = await rpc("tools/call", { name, arguments: SAMPLE_ARGS[name] });
      expect(!message?.error, `${name}: JSON-RPC error ${message?.error?.code} ${message?.error?.message}`);
      const result = message?.result as Record<string, unknown> | undefined;
      expect(result, `${name}: no result`);
      if (result?.isError) {
        const code = errorCodeOf(result);
        expect(code && EXPECTED_ERROR_CODES.has(code), `${name}: unexpected tool error ${code ?? JSON.stringify(result.content)}`);
        notes.push(`${name}=${code}`);
      } else {
        const parsed = toolContracts[name].output.safeParse(result?.structuredContent);
        expect(parsed.success, `${name}: structuredContent violates its contract`);
        notes.push(`${name}=ok`);
      }
    }
    return notes.join(", ");
  });

  await check("invalid arguments are reported as an error the caller can act on", async () => {
    const { message } = await rpc("tools/call", { name: "identify_product", arguments: {} });
    const result = message?.result as Record<string, unknown> | undefined;
    const firstText = Array.isArray(result?.content) ? String((result?.content[0] as { text?: unknown })?.text ?? "") : "";
    const reported = message?.error?.code === -32602 || (result?.isError === true && (errorCodeOf(result) === "INVALID_INPUT" || firstText.includes("validation error") || firstText.includes("-32602")));
    expect(reported, `got ${JSON.stringify(message).slice(0, 200)}`);
  });

  await check("unknown tool name is rejected", async () => {
    const { message } = await rpc("tools/call", { name: "no_such_tool", arguments: {} });
    const result = message?.result as Record<string, unknown> | undefined;
    expect(message?.error !== undefined || result?.isError === true, "unknown tool was accepted");
  });

  await check("GET /mcp is 405 (stateless: no server-initiated stream) or an SSE stream", async () => {
    const res = await fetchFn(url, { method: "GET", headers: { Accept: "text/event-stream", ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) } });
    const type = res.headers.get("content-type") ?? "";
    await res.body?.cancel();
    expect(res.status === 405 || type.includes("text/event-stream"), `HTTP ${res.status} ${type}`);
  });

  await check("a browser request from an unlisted Origin is refused (403)", async () => {
    const res = await fetchFn(url, {
      method: "POST",
      headers: headers({ Origin: "https://evil.example" }),
      body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method: "tools/list" }),
    });
    await res.text();
    expect(res.status === 403, `HTTP ${res.status}`);
  });

  if (opts.token) {
    await check("requests without the bearer token are refused (401)", async () => {
      const res = await fetchFn(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
        body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method: "tools/list" }),
      });
      await res.text();
      expect(res.status === 401, `HTTP ${res.status}`);
    });
  }
  return results;
}
