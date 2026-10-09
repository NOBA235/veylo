import { config } from "dotenv";
import { fileURLToPath } from "node:url";

// Load the repo-root .env (packages/db/src -> repo root). Missing file is fine: defaults apply.
config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

export const DEFAULT_DATABASE_URL = "postgres://veylo:veylo@localhost:5432/veylo";
