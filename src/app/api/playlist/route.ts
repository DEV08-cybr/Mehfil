import type { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import type { Track } from "@/lib/types";
import { fetchPlaylistEntries, type PlaylistEntry } from "@/lib/youtube";

export const dynamic = "force-dynamic";
export const maxDuration = 25;

/** Pull a YouTube playlist ID out of any playlist URL. */
function parsePlaylistId(input: string): string | null {
  const raw = input.trim();
  const m =
    raw.match(/[?&]list=([A-Za-z0-9_-]{10,})/) ??
    raw.match(/youtube\.com\/playlist\/([A-Za-z0-9_-]{10,})/) ??
    raw.match(/youtu\.be\/[A-Za-z0-9_-]{11}\?.*\blist=([A-Za-z0-9_-]{10,})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{10,}$/.test(raw) ? raw : null;
}

const cache = new Map<string, { at: number; body: unknown }>();
const TTL = 30 * 60 * 1000;

/** Import a YouTube playlist as a list of playable tracks. */
export async function GET(request: NextRequest) {
  const limited = rateLimit(request, "playlist", 30, 60_000);
  if (limited) return limited;

  const id = parsePlaylistId(request.nextUrl.searchParams.get("list") ?? "");
  if (!id) {
    return Response.json({ error: "Paste a YouTube playlist link (it should contain list=…)." }, { status: 400 });
  }

  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < TTL) return Response.json(hit.body);

  try {
    let items: PlaylistEntry[];
    try {
      items = await fetchPlaylistEntries(id);
    } catch (e) {
      const msg = (e as Error).message ?? "";
      // Only a genuine transport failure is a network problem; anything
      // else means the page came back but wasn't a readable playlist
      // (private, radio/mix, deleted, or a non-playlist link).
      const unreadable = !/fetch failed|network|timeout|aborted/i.test(msg);
      return Response.json(
        {
          error: unreadable
            ? "Couldn't read that playlist. Make sure it's public (not private, a radio/mix, or deleted)."
            : "Couldn't reach YouTube to read that playlist. Try again.",
        },
        { status: unreadable ? 404 : 502 }
      );
    }
    if (items.length === 0) {
      return Response.json(
        { error: "Couldn't read that playlist. Make sure it's public (not private, a radio/mix, or deleted)." },
        { status: 404 }
      );
    }

    const tracks: Track[] = items.map((it: { id: string; title: string; channel: string; duration: string; thumbnail: string }) => ({
      key: `youtube:${it.id}`,
      source: "youtube",
      id: it.id,
      title: it.title,
      artist: it.channel || "YouTube",
      duration: it.duration || "",
      thumbnail: it.thumbnail || `https://i.ytimg.com/vi/${it.id}/mqdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${it.id}`,
    }));

    const body = { ok: true, id, count: tracks.length, tracks };
    cache.set(id, { at: Date.now(), body });
    return Response.json(body);
  } catch {
    return Response.json({ error: "Couldn't reach YouTube to read that playlist. Try again." }, { status: 502 });
  }
}