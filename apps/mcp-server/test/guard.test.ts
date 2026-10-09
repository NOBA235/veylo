import assert from "node:assert/strict";
import { test } from "node:test";
import { loadConfig } from "../src/config";
import { checkRequest, isLoopbackOrigin } from "../src/guard";

const cfg = { allowedOrigins: ["https://app.example.com/"] };

test("requests without an Origin (non-browser clients) are allowed", () => {
  assert.deepEqual(checkRequest({}, cfg), { ok: true });
});
test("loopback origins are always allowed; listed origins match ignoring case and trailing slash", () => {
  for (const o of ["http://localhost:3000", "http://127.0.0.1:6274", "http://[::1]:8080", "https://APP.example.com"]) {
    assert.equal(checkRequest({ origin: o }, cfg).ok, true, o);
  }
});
test("any other browser origin is refused with 403, including look-alikes", () => {
  for (const o of ["https://evil.example", "https://app.example.com.evil.example", "http://localhost.evil.example", "not a url"]) {
    assert.deepEqual(checkRequest({ origin: o }, cfg), { ok: false, status: 403, message: "Origin not allowed." }, o);
  }
  assert.equal(isLoopbackOrigin("http://localhost.evil.example"), false);
});
test("bearer auth: required when configured, exact match only", () => {
  const secured = { allowedOrigins: [], authToken: "s3cret-token" };
  assert.equal(checkRequest({ authorization: "Bearer s3cret-token" }, secured).ok, true);
  assert.equal(checkRequest({ authorization: "bearer s3cret-token" }, secured).ok, true);
  for (const bad of [undefined, "", "Bearer wrong-token!", "Bearer s3cret-toke", "Basic s3cret-token", "s3cret-token"]) {
    assert.deepEqual(checkRequest({ authorization: bad }, secured), { ok: false, status: 401, message: "Missing or invalid bearer token." }, String(bad));
  }
});
test("origin is checked before auth", () => {
  const r = checkRequest({ origin: "https://evil.example", authorization: "Bearer s3cret-token" }, { allowedOrigins: [], authToken: "s3cret-token" });
  assert.equal(r.ok === false && r.status, 403);
});

test("config defaults to loopback on port 8787 with JSON responses", () => {
  assert.deepEqual(loadConfig({}), { port: 8787, host: "127.0.0.1", allowedOrigins: [], authToken: undefined, jsonResponse: true, braveApiKey: undefined });
});
test("config parses origins, token and flags", () => {
  const c = loadConfig({ MCP_PORT: "9000", MCP_ALLOWED_ORIGINS: " https://a.example , ,https://b.example", MCP_AUTH_TOKEN: " tok ", MCP_JSON_RESPONSE: "false", BRAVE_SEARCH_API_KEY: "k" });
  assert.deepEqual([c.port, c.allowedOrigins, c.authToken, c.jsonResponse, c.braveApiKey], [9000, ["https://a.example", "https://b.example"], "tok", false, "k"]);
});
test("config refuses a bad port and a public bind without auth", () => {
  assert.throws(() => loadConfig({ MCP_PORT: "70000" }), /not a valid port/);
  assert.throws(() => loadConfig({ MCP_PORT: "abc" }), /not a valid port/);
  assert.throws(() => loadConfig({ MCP_HOST: "0.0.0.0" }), /MCP_AUTH_TOKEN/);
  assert.equal(loadConfig({ MCP_HOST: "0.0.0.0", MCP_AUTH_TOKEN: "t" }).host, "0.0.0.0");
  assert.equal(loadConfig({ MCP_HOST: "0.0.0.0", MCP_ALLOW_INSECURE_PUBLIC: "true" }).host, "0.0.0.0");
});
