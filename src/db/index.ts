import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// Mehfil itself does not use a database. This client is kept for optional
// tooling and must NOT crash the app on hosts (e.g. Vercel) that have no
// DATABASE_URL configured — so it is created lazily.
const databaseUrl = process.env.DATABASE_URL;

const globalForDb = globalThis as typeof globalThis & {
  __mehfilPool?: Pool;
};

function createPool(): Pool {
  if (globalForDb.__mehfilPool) return globalForDb.__mehfilPool;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }
  const pool = new Pool({ connectionString: databaseUrl });
  if (process.env.NODE_ENV !== "production") {
    globalForDb.__mehfilPool = pool;
  }
  return pool;
}

// Lazy proxy: constructing the Pool (and therefore requiring DATABASE_URL)
// only happens when something actually executes a query.
export const pool = new Proxy({} as Pool, {
  get(_t, prop) {
    const real = createPool() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export const db = drizzle(pool);
