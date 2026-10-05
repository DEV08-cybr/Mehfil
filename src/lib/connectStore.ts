/**
 * Storage for device-connection sessions.
 * Uses PostgreSQL (via Drizzle) when DATABASE_URL is configured, otherwise an
 * in-memory map (fine for a single server; use a database on serverless).
 */
import { eq, lt, sql } from "drizzle-orm";
import { getDb, type Database } from "@/db";
import { deviceSessions } from "@/db/schema";

export interface ConnectCommand {
  action: string;
  payload: unknown;
  at: number;
}

type State = Record<string, unknown> | null;

interface MemSession {
  state: State;
  commands: ConnectCommand[];
  updatedAt: number;
}

const TTL_MS = 12 * 60 * 60 * 1000;
const MAX_PENDING = 40;
// No 0/O/1/I to avoid confusion when typing a code
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const g = globalThis as typeof globalThis & {
  __mehfilMemSessions?: Map<string, MemSession>;
  __mehfilTableReady?: Promise<boolean>;
};
const mem: Map<string, MemSession> =
  g.__mehfilMemSessions ?? (g.__mehfilMemSessions = new Map());

function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

function rowsOf(res: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(res)) return res as Array<Record<string, unknown>>;
  return (res as { rows?: Array<Record<string, unknown>> } | null)?.rows ?? [];
}

/** Returns the DB when it is configured and the table exists (auto-created). */
async function dbReady(): Promise<Database | null> {
  const db = getDb();
  if (!db) return null;
  if (!g.__mehfilTableReady) {
    g.__mehfilTableReady = db
      .execute(
        sql`CREATE TABLE IF NOT EXISTS device_sessions (
          code varchar(12) PRIMARY KEY,
          state jsonb,
          commands jsonb NOT NULL DEFAULT '[]'::jsonb,
          created_at timestamp with time zone NOT NULL DEFAULT now(),
          updated_at timestamp with time zone NOT NULL DEFAULT now()
        )`
      )
      .then(
        () => true,
        () => {
          g.__mehfilTableReady = undefined;
          return false;
        }
      );
  }
  return (await g.__mehfilTableReady) ? db : null;
}

export async function isPersistent(): Promise<boolean> {
  return (await dbReady()) !== null;
}

function sweepMem(): void {
  const now = Date.now();
  for (const [code, s] of mem) if (now - s.updatedAt > TTL_MS) mem.delete(code);
}

export async function createSession(): Promise<{ code: string; persistent: boolean }> {
  const db = await dbReady();
  if (db) {
    await db
      .delete(deviceSessions)
      .where(lt(deviceSessions.updatedAt, new Date(Date.now() - TTL_MS)))
      .catch(() => undefined);

    for (let i = 0; i < 8; i++) {
      const code = newCode();
      const rows = await db
        .insert(deviceSessions)
        .values({ code, state: null, commands: [] })
        .onConflictDoNothing()
        .returning({ code: deviceSessions.code });
      if (rows.length > 0) return { code, persistent: true };
    }
    throw new Error("Could not allocate a session code");
  }

  sweepMem();
  let code = newCode();
  while (mem.has(code)) code = newCode();
  mem.set(code, { state: null, commands: [], updatedAt: Date.now() });
  return { code, persistent: false };
}

export async function pushState(code: string, state: State): Promise<boolean> {
  const db = await dbReady();
  if (db) {
    const rows = await db
      .update(deviceSessions)
      .set({ state, updatedAt: new Date() })
      .where(eq(deviceSessions.code, code))
      .returning({ code: deviceSessions.code });
    return rows.length > 0;
  }
  const s = mem.get(code);
  if (!s) return false;
  s.state = state;
  s.updatedAt = Date.now();
  return true;
}

export async function readState(
  code: string
): Promise<{ state: State; updatedAt: number } | null> {
  const db = await dbReady();
  if (db) {
    const rows = await db
      .select({ state: deviceSessions.state, updatedAt: deviceSessions.updatedAt })
      .from(deviceSessions)
      .where(eq(deviceSessions.code, code))
      .limit(1);
    if (rows.length === 0) return null;
    return { state: rows[0].state ?? null, updatedAt: rows[0].updatedAt.getTime() };
  }
  const s = mem.get(code);
  return s ? { state: s.state, updatedAt: s.updatedAt } : null;
}

export async function addCommand(code: string, cmd: ConnectCommand): Promise<boolean> {
  const db = await dbReady();
  if (db) {
    // Atomic append; reset if a host has been offline long enough to pile up
    const res = await db.execute(
      sql`UPDATE device_sessions
          SET commands = (CASE WHEN jsonb_array_length(commands) >= ${MAX_PENDING}
                               THEN '[]'::jsonb ELSE commands END) || ${JSON.stringify([cmd])}::jsonb
          WHERE code = ${code}
          RETURNING code`
    );
    return rowsOf(res).length > 0;
  }
  const s = mem.get(code);
  if (!s) return false;
  if (s.commands.length >= MAX_PENDING) s.commands = [];
  s.commands.push(cmd);
  return true;
}

export async function consumeCommands(
  code: string
): Promise<{ found: boolean; commands: ConnectCommand[] }> {
  const db = await dbReady();
  if (db) {
    // Cheap read first, so idle polling never writes
    const peek = rowsOf(
      await db.execute(
        sql`SELECT jsonb_array_length(commands) AS n FROM device_sessions WHERE code = ${code}`
      )
    );
    if (peek.length === 0) return { found: false, commands: [] };
    if (Number(peek[0].n) === 0) return { found: true, commands: [] };

    // Atomically take everything that is pending
    const taken = rowsOf(
      await db.execute(
        sql`WITH old AS (
              SELECT code, commands FROM device_sessions WHERE code = ${code} FOR UPDATE
            )
            UPDATE device_sessions AS d SET commands = '[]'::jsonb
            FROM old WHERE d.code = old.code
            RETURNING old.commands AS commands`
      )
    );
    const raw = taken[0]?.commands;
    return { found: true, commands: Array.isArray(raw) ? (raw as ConnectCommand[]) : [] };
  }
  const s = mem.get(code);
  if (!s) return { found: false, commands: [] };
  const commands = s.commands;
  s.commands = [];
  return { found: true, commands };
}