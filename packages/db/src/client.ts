import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { DEFAULT_DATABASE_URL } from "./env";
import * as schema from "./schema";

export function createDb(connectionString = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL) {
  const pool = new pg.Pool({ connectionString });
  const db = drizzle(pool, { schema });
  return { db, pool };
}

export type Db = ReturnType<typeof createDb>["db"];
