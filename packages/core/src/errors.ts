export type ErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "UNKNOWN_CATEGORY"
  | "GEOCODE_FAILED"
  | "UPSTREAM_UNAVAILABLE"
  | "NOT_CONFIGURED";

/** Domain error. The MCP layer maps `code` to a structured tool error. */
export class VeyloError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "VeyloError";
  }
}
