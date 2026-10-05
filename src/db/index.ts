import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as typeof globalThis & {
  __mehfilPool?: Pool;
  __mehfilDb?: Database;
};

/**
 * Lazily returns the Drizzle client, or null when DATABASE_URL is not set.
 * The app keeps working without a database (device sync falls back to an
 * in-memory store), so nothing here may throw at import time.
 */
export function getDb(): Database | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;

  if (!globalForDb.__mehfilDb) {
    const pool =
      globalForDb.__mehfilPool ??
      new Pool({ connectionString: url, max: 5, idleTimeoutMillis: 30_000 });
    globalForDb.__mehfilPool = pool;
    globalForDb.__mehfilDb = drizzle({ client: pool, schema });
  }
  return globalForDb.__mehfilDb;
}