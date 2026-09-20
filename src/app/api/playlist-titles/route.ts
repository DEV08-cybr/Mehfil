import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
// Keep the function comfortably inside serverless time limits.
export const maxDuration = 10;

/**
 * Resolves video titles from YouTube's public oEmbed endpoint
 * (no API key). Always resolves quickly with whatever titles it
 * gathered — missing ones get filled in as the user plays.
 */
export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const raw = (body as { videoIds?: unknown })?.videoIds;

    if (!Array.isArray(raw)) {
      return Response.json(
        { error: "videoIds must be an array" },
        { status: 400 }
      );
    }

    const videoIds = raw
      .filter(
        (v): v is string =>
          typeof v === "string" && /^[A-Za-z0-9_-]{11}$/.test(v)
      )
      .slice(0, 120);

    const titles: Record<string, string> = {};
    const queue = [...videoIds];
    const CONCURRENCY = 24;
    const PER_REQUEST_MS = 5000;

    async function worker() {
      while (queue.length > 0) {
        const id = queue.shift();
        if (!id) break;
        try {
          const res = await fetch(
            `https://www.youtube.com/oembed?url=${encodeURIComponent(
              `https://www.youtube.com/watch?v=${id}`
            )}&format=json`,
            { signal: AbortSignal.timeout(PER_REQUEST_MS) }
          );
          if (res.ok) {
            const data = (await res.json()) as { title?: string };
            if (data.title) titles[id] = data.title;
          }
        } catch {
          /* skip — title can be filled in later during playback */
        }
      }
    }

    const workers = Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, videoIds.length) }, worker)
    );

    // Hard ceiling: respond with partial results rather than risk a timeout.
    await Promise.race([
      workers,
      new Promise((r) => setTimeout(r, 7500)),
    ]);

    return Response.json({ titles });
  } catch {
    return Response.json({ titles: {} }, { status: 200 });
  }
}
