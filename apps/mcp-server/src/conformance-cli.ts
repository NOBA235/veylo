import { runConformance } from "./conformance";

const url = process.argv[2] ?? process.env.MCP_SERVER_URL ?? "http://127.0.0.1:8787/mcp";
const token = process.env.MCP_AUTH_TOKEN || undefined;

const results = await runConformance(url, { token });
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `\n      ${r.detail}` : ""}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed against ${url}`);
process.exit(failed === 0 ? 0 : 1);
