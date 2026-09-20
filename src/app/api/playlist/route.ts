import {
  dedupeByTitle,
  fetchPlaylistItems,
  fetchVideoMetas,
  type PlaylistItem,
} from "@/lib/youtube";
import {
  FALLBACK_SECTIONS,
  SEGMENTS,
} from "@/lib/mehfil";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const CACHE_TTL_MS = 30 * 60 * 1000;

let cache: { data: unknown; at: number } | null = null;
let inflight: Promise<unknown> | null = null;

function fallbackItems(i: number, segLabel: string): PlaylistItem[] {
  const fb = FALLBACK_SECTIONS[i];
  if (!fb) return [];
  return fb.ids.map((id) => ({
    id,
    title: "",
    channel: "",
    duration: "",
    thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    segmentIndex: i,
    segmentLabel: segLabel,
  }));
}

async function load(): Promise<Record<string, unknown>> {
  const items: PlaylistItem[] = [];
  const sections: { label: string; count: number }[] = [];
  const singles: PlaylistItem[] = [];

  for (let i = 0; i < SEGMENTS.length; i++) {
    const seg = SEGMENTS[i];
    let got: PlaylistItem[] = [];

    // Try the live source up to twice (a throttled YouTube page returns
    // HTTP 200 but empty, so an EMPTY result also counts as a failure).
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (seg.type === "playlist") {
          got = await fetchPlaylistItems(seg.id, i, seg.label);
        } else {
          got = await fetchVideoMetas(seg.ids, i, seg.label);
        }
        if (got.length > 0) break;
      } catch {
        got = [];
      }
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 800));
      }
    }

    if (got.length === 0) {
      // Live source unavailable — use the baked-in snapshot so the archive
      // never comes up empty.
      got = fallbackItems(i, seg.label);
    }

    items.push(...got);
    if (seg.type === "videos") singles.push(...got);
    sections.push({ label: seg.label, count: got.length });
  }

  // ID-based dedupe: drop playlist copies of handpicked singles, keep
  // the singles themselves (they live in the last segment already).
  const singleIds = new Set(singles.map((s) => s.id));
  const idSeen = new Set<string>();
  const deduped: PlaylistItem[] = [];
  for (const it of items) {
    if (singleIds.has(it.id)) continue;
    if (idSeen.has(it.id)) continue;
    idSeen.add(it.id);
    deduped.push(it);
  }
  for (const s of singles) {
    if (idSeen.has(s.id)) continue;
    idSeen.add(s.id);
    deduped.push(s);
  }

  // Title-based dedupe (same song re-uploaded under another ID)
  const before = deduped.length;
  const finalItems = dedupeByTitle(deduped, singles.map((s) => s.id));

  return {
    items: finalItems,
    sections: sections.map((s) => ({
      label: s.label,
      count: finalItems.filter((i) => i.segmentLabel === s.label).length,
    })),
    removedDuplicates: before - finalItems.length,
  };
}

export async function GET() {
  try {
    if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
      return Response.json(cache.data, {
        headers: { "Cache-Control": "public, max-age=600" },
      });
    }
    if (inflight) {
      const data = await inflight;
      return Response.json(data, {
        headers: { "Cache-Control": "public, max-age=600" },
      });
    }
    inflight = load()
      .then((data) => {
        cache = { data, at: Date.now() };
        return data;
      })
      .finally(() => {
        inflight = null;
      });
    const data = await inflight;
    return Response.json(data, {
      headers: { "Cache-Control": "public, max-age=600" },
    });
  } catch {
    if (cache) return Response.json(cache.data);
    // Last resort: serve the baked snapshot with placeholder metadata
    const fb = FALLBACK_SECTIONS.flatMap((s, i) =>
      s.ids.map((id) => ({
        id,
        title: "",
        channel: "",
        duration: "",
        thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        segmentIndex: i,
        segmentLabel: s.label,
      }))
    );
    return Response.json({
      items: fb,
      sections: FALLBACK_SECTIONS.map((s) => ({
        label: s.label,
        count: s.ids.length,
      })),
      removedDuplicates: 0,
      stale: true,
    });
  }
}
