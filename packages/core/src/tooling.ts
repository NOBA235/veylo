// SDK-independent tool execution layer. The MCP server registers `createToolExecutor(...)` handlers;
// the MCP client and the agent decode results with `decodeToolResult`. Wire-format knowledge lives here only.
import { TOOL_NAMES, toolContracts, type ToolName } from "@veylo/types";
import type { ZodIssue } from "zod";
import type { Logger } from "./context";
import { VeyloError, type ErrorCode } from "./errors";
import type { CoreServices } from "./services";
import type { ToolInput, ToolOutput } from "./tool-types";

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
  _meta?: Record<string, unknown>;
}
export type ToolHandlers = Record<ToolName, (args: unknown) => Promise<ToolResult>>;
export type ToolErrorCode = ErrorCode | "INTERNAL_ERROR";

/** Anything that can run a Veylo tool: the MCP client in production, a loopback in tests. */
export interface ToolCaller {
  call<N extends ToolName>(name: N, input: ToolInput<N>): Promise<ToolOutput<N>>;
}

export class ToolCallError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ToolCallError";
  }
}

const ERROR_META_KEY = "veylo/error";

function errorResult(code: ToolErrorCode, message: string, details?: Record<string, unknown>): ToolResult {
  return {
    isError: true,
    content: [{ type: "text", text: `${code}: ${message}` }],
    // Error details travel in _meta, not structuredContent, so they never clash with a tool's outputSchema.
    _meta: { [ERROR_META_KEY]: { code, message, ...(details ? { details } : {}) } },
  };
}

const formatIssues = (issues: ZodIssue[]) =>
  issues.map((i) => `${i.path.join(".") || "(input)"}: ${i.message}`).join("; ");

export function createToolExecutor(services: CoreServices, logger?: Logger): ToolHandlers {
  const handlers = {} as ToolHandlers;
  for (const name of TOOL_NAMES) {
    const contract = toolContracts[name];
    const run = services[name] as (args: unknown) => Promise<unknown>;
    handlers[name] = async (args) => {
      const input = contract.input.safeParse(args ?? {});
      if (!input.success) return errorResult("INVALID_INPUT", formatIssues(input.error.issues));
      try {
        const raw = await run(input.data);
        // Never emit a result that violates its own contract (e.g. CONFIRMED without evidence).
        const output = contract.output.safeParse(raw);
        if (!output.success) {
          logger?.warn("tool produced an invalid result", { tool: name, issues: formatIssues(output.error.issues) });
          return errorResult("INTERNAL_ERROR", "The tool produced an invalid result and it was withheld.");
        }
        // Round-trip through JSON so both representations are identical and free of `undefined`.
        const json = JSON.stringify(output.data);
        return { content: [{ type: "text", text: json }], structuredContent: JSON.parse(json) as Record<string, unknown> };
      } catch (err) {
        if (err instanceof VeyloError) return errorResult(err.code, err.message, err.details);
        logger?.warn("tool failed unexpectedly", { tool: name, reason: String(err) });
        return errorResult("INTERNAL_ERROR", "Unexpected error while running the tool.");
      }
    };
  }
  return handlers;
}

const firstText = (r: ToolResult) => r.content.find((c) => c.type === "text")?.text ?? "";

/** Inverse of the executor: returns the typed output, or throws ToolCallError. */
export function decodeToolResult<N extends ToolName>(name: N, result: ToolResult): ToolOutput<N> {
  if (result.isError) {
    const meta = result._meta?.[ERROR_META_KEY] as { code?: string; message?: string; details?: Record<string, unknown> } | undefined;
    throw new ToolCallError(meta?.code ?? "UNKNOWN", meta?.message ?? firstText(result), meta?.details);
  }
  let payload: unknown = result.structuredContent;
  if (payload === undefined) {
    try {
      payload = JSON.parse(firstText(result));
    } catch {
      throw new ToolCallError("INVALID_RESULT", `${name} returned neither structuredContent nor JSON text.`);
    }
  }
  const parsed = toolContracts[name].output.safeParse(payload);
  if (!parsed.success) throw new ToolCallError("INVALID_RESULT", `${name} result does not match its contract: ${formatIssues(parsed.error.issues)}`);
  return parsed.data as ToolOutput<N>;
}

/** Calls handlers in-process through the same encode/decode as the wire, minus the transport. */
export function createLoopbackCaller(handlers: ToolHandlers): ToolCaller {
  return {
    async call(name, input) {
      return decodeToolResult(name, await handlers[name](input));
    },
  };
}
