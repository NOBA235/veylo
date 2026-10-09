import { config } from "dotenv";
import { fileURLToPath } from "node:url";

// Load the repo-root .env (apps/mcp-server/src -> repo root). A missing file is fine.
config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });
