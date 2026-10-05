import type { NextRequest } from "next/server";
import {
  addCommand,
  consumeCommands,
  createSession,
  isPersistent,
  pushState,
  readState,
} from "@/lib/connectStore";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const CODE_RE = /^[A-Z0-9]{6}$/;
const ACTIONS = new Set([
  "play",
  "pause",
  "next",
  "prev",
  "seek",
  "volume",
  "playTrack",
  "enqueue",
]);
const NO_STORE = { "Cache-Control": "no-store" };

function fail(error: string, status: number) {
  return Response.json({ error }, { status, headers: NO_STORE });
}

/**
 * GET ?code=XXXXXX&role=host   → pending commands (and clears them)
 * GET ?code=XXXXXX&role=remote → the host's latest player state
 */
export async function GET(request: NextRequest) {
  const limited = rateLimit(request, "connect", 400, 60_000);
  if (limited) return limited;

  const code = (request.nextUrl.searchParams.get("code") ?? "").toUpperCase();
  const role = request.nextUrl.searchParams.get("role");
  if (!CODE_RE.test(code)) return fail("Invalid session code", 400);

  try {
    if (role === "host") {
      const r = await consumeCommands(code);
      if (!r.found) return fail("Session not found", 404);
      return Response.json(
        { ok: true, commands: r.commands, persistent: await isPersistent() },
        { headers: NO_STORE }
      );
    }

    const s = await readState(code);
    if (!s) return fail("Session not found", 404);
    return Response.json(
      {
        ok: true,
        state: s.state,
        updatedAt: s.updatedAt,
        serverNow: Date.now(),
        persistent: await isPersistent(),
      },
      { headers: NO_STORE }
    );
  } catch {
    return fail("Device sync is temporarily unavailable", 503);
  }
}

/**
 * POST { action: "create" }
 * POST { action: "state", code, state }          (host)
 * POST { action: "command", code, command }      (remote)
 */
export async function POST(request: NextRequest) {
  const limited = rateLimit(request, "connect", 400, 60_000);
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return fail("Invalid JSON", 400);
  }

  try {
    if (body.action === "create") {
      const tooMany = rateLimit(request, "connect-create", 30, 60 * 60_000);
      if (tooMany) return tooMany;
      const r = await createSession();
      return Response.json({ ok: true, code: r.code, persistent: r.persistent }, { headers: NO_STORE });
    }

    const code = typeof body.code === "string" ? body.code.toUpperCase() : "";
    if (!CODE_RE.test(code)) return fail("Invalid session code", 400);

    if (body.action === "state") {
      const json = JSON.stringify(body.state ?? null);
      if (json.length > 60_000) return fail("State too large", 413);
      const ok = await pushState(code, JSON.parse(json) as Record<string, unknown> | null);
      return ok ? Response.json({ ok: true }, { headers: NO_STORE }) : fail("Session not found", 404);
    }

    if (body.action === "command") {
      const cmd = body.command as { action?: unknown; payload?: unknown } | undefined;
      if (!cmd || typeof cmd.action !== "string" || !ACTIONS.has(cmd.action)) {
        return fail("Unknown command", 400);
      }
      if (JSON.stringify(cmd.payload ?? null).length > 4_000) return fail("Command too large", 413);
      const ok = await addCommand(code, {
        action: cmd.action,
        payload: cmd.payload ?? null,
        at: Date.now(),
      });
      return ok ? Response.json({ ok: true }, { headers: NO_STORE }) : fail("Session not found", 404);
    }

    return fail("Unknown action", 400);
  } catch {
    return fail("Device sync is temporarily unavailable", 503);
  }
}