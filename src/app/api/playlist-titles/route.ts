import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Fetches video titles from YouTube's oEmbed endpoint.
 * No API key required — uses the public oEmbed JSON API.
 * Returns a map of videoId → title.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const videoIds: string[] = body.videoIds;

    if (!Array.isArray(videoIds)) {
      return Response.json(
        { error: "videoIds must be an array" },
        { status: 400 }
      );
    }

    const titles: Record<string, string> = {};
    const queue = videoIds.slice(0, 100).filter(Boolean);
    const CONCURRENCY = 20;

    async function worker() {
      while (queue.length > 0) {
        const id = queue.shift()!;
        try {
          const res = await fetch(
            `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(id)}&format=json`,
            { signal: AbortSignal.timeout(6000), cache: "force-cache" }
          );
          if (res.ok) {
            const data: { title?: string } = await res.json();
            if (data.title) {
              titles[id] = data.title;
            }
          }
        } catch {
          // Skip failed fetches silently
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () =>
        worker()
      )
    );

    return Response.json({ titles });
  } catch {
    return Response.json(
      { error: "Failed to fetch playlist titles" },
      { status: 500 }
    );
  }
}