// Request guard for the Streamable HTTP endpoint: Origin validation (DNS-rebinding defence) and optional bearer auth.
import { timingSafeEqual } from "node:crypto";

export interface GuardConfig {
  /** Extra origins to allow. Loopback origins (localhost, 127.0.0.1, [::1]) are always allowed. */
  allowedOrigins: string[];
  /** When set, every request must send `Authorization: Bearer <token>`. */
  authToken?: string;
}
export type GuardResult = { ok: true } | { ok: false; status: 401 | 403; message: string };

const trimSlash = (s: string) => s.replace(/\/+$/, "").toLowerCase();

export function isLoopbackOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";
  } catch {
    return false;
  }
}

function tokenMatches(header: string | undefined, token: string): boolean {
  const m = /^Bearer\s+(.+)$/i.exec(header ?? "");
  if (!m?.[1]) return false;
  const a = Buffer.from(m[1]);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function checkRequest(headers: { origin?: string; authorization?: string }, cfg: GuardConfig): GuardResult {
  // Non-browser clients send no Origin. A browser always does, so an unlisted Origin is rejected.
  if (headers.origin !== undefined) {
    const allowed = isLoopbackOrigin(headers.origin) || cfg.allowedOrigins.map(trimSlash).includes(trimSlash(headers.origin));
    if (!allowed) return { ok: false, status: 403, message: "Origin not allowed." };
  }
  if (cfg.authToken && !tokenMatches(headers.authorization, cfg.authToken)) {
    return { ok: false, status: 401, message: "Missing or invalid bearer token." };
  }
  return { ok: true };
}
