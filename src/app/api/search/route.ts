import type { NextRequest } from "next/server";
import { searchAudius } from "@/lib/audius";
import { rateLimit } from "@/lib/rateLimit";
import type { Track } from "@/lib/types";
import { parseYouTubeId, searchYouTube, youtubeFromId } from "@/lib/youtube";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

interface SearchResponse {
  results: Track[];
  /** Which service produced the results */
  source: "audius" | "youtube" | "link";
  /** true when Audius had nothing and YouTube was used as a fallback */
  fallback: boolean;
  error?: string;
}

const TTL_MS = 10 * 60 * 1000;
const g = globalThis as typeof globalThis & {
  __mehfilSearchCache?: Map<string, { at: number; body: SearchResponse }>;
};
const cache = g.__mehfilSearchCache ?? (g.__mehfilSearchCache = new Map());

/**
 * Ad-free first: Audius is queried first and used whenever it returns
 * anything. YouTube is only consulted when Audius has no matches, and the
 * response is flagged as a fallback so the UI can warn about YouTube ads.
 */
export async function GET(request: NextRequest) {
  const limited = rateLimit(request, "search", 90, 60_000);
  if (limited) return limited;

  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 200);
  const limit = Math.min(20, Math.max(1, Number(request.nextUrl.searchParams.get("limit")) || 5));
  const forceYouTube = request.nextUrl.searchParams.get("youtube") === "1";

  if (q.length < 2) {
    return Response.json({ results: [], source: "audius", fallback: false } satisfies SearchResponse);
  }

  // Pasted links always play directly
  const ytId = parseYouTubeId(q);
  if (ytId) {
    return Response.json({
      results: [await youtubeFromId(ytId)],
      source: "link",
      fallback: false,
    } satisfies SearchResponse);
  }

  const key = `${limit}|${forceYouTube ? "yt" : "au"}|${q.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return Response.json(hit.body);

  const remember = (body: SearchResponse) => {
    if (!body.error) {
      cache.set(key, { at: Date.now(), body });
      if (cache.size > 300) {
        const oldest = cache.keys().next().value;
        if (oldest) cache.delete(oldest);
      }
    }
    return Response.json(body);
  };

  // 1) Audius — free, ad-free, direct audio
  if (!forceYouTube) {
    try {
      const audius = await searchAudius(q, limit);
      if (audius.length > 0) {
        return remember({ results: audius, source: "audius", fallback: false });
      }
    } catch {
      // fall through to YouTube
    }
  }

  // 2) YouTube — only when Audius found nothing
  try {
    const yt = await searchYouTube(q, limit);
    return remember({
      results: yt,
      source: "youtube",
      fallback: !forceYouTube,
      error: yt.length === 0 ? "No results found." : undefined,
    });
  } catch {
    return Response.json({
      results: [],
      source: "youtube",
      fallback: false,
      error: "Search failed — check your connection and try again.",
    } satisfies SearchResponse);
  }
}