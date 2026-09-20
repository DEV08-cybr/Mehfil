/**
 * Scrapes YouTube playlist contents (first page) using the public
 * Web page markup, and resolves single-video metadata via oEmbed.
 * No API key required.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

export interface PlaylistItem {
  id: string;
  title: string;
  channel: string;
  duration: string;
  thumbnail: string;
  segmentIndex: number;
  segmentLabel: string;
}

/* ── Extract the balanced JSON object following `marker` ──── */

function extractJsonAfter(html: string, marker: string): unknown | null {
  const i = html.indexOf(marker);
  if (i < 0) return null;
  const s = html.indexOf("{", i);
  if (s < 0) return null;

  let depth = 0;
  let inStr = false;
  let esc = false;

  for (let j = s; j < html.length; j++) {
    const c = html[j];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(s, j + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/* ── Recursively collect lockupViewModel nodes ────────────── */

interface Lockup {
  contentId?: string;
  metadata?: {
    lockupMetadataViewModel?: {
      title?: { content?: string };
      metadata?: {
        contentMetadataViewModel?: {
          metadataRows?: Array<{
            metadataParts?: Array<{ text?: { content?: string } }>;
          }>;
        };
      };
    };
  };
  contentImage?: {
    thumbnailViewModel?: {
      image?: { sources?: Array<{ url?: string; width?: number }> };
      overlays?: Array<{
        thumbnailBottomOverlayViewModel?: {
          badges?: Array<{ thumbnailBadgeViewModel?: { text?: string } }>;
        };
      }>;
    };
  };
}

function collectLockups(node: unknown, out: Lockup[]): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const n of node) collectLockups(n, out);
    return;
  }
  const obj = node as Record<string, unknown>;
  const lv = obj.lockupViewModel;
  if (lv && typeof lv === "object") out.push(lv as Lockup);
  for (const k in obj) {
    if (k !== "lockupViewModel") collectLockups(obj[k], out);
  }
}

function mapLockup(lv: Lockup, segmentIndex: number, segmentLabel: string): PlaylistItem | null {
  const id = lv.contentId;
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return null;

  const meta = lv.metadata?.lockupMetadataViewModel;
  const title = meta?.title?.content ?? "";

  let channel = "";
  for (const row of meta?.metadata?.contentMetadataViewModel?.metadataRows ?? []) {
    for (const part of row.metadataParts ?? []) {
      const t = part.text?.content;
      if (t && !/^\d[\d:]*$/.test(t) && !t.includes("views")) {
        channel = t;
        break;
      }
    }
    if (channel) break;
  }

  let duration = "";
  let bestThumb = "";
  const tv = lv.contentImage?.thumbnailViewModel;
  for (const src of tv?.image?.sources ?? []) {
    if (src.url && (!bestThumb || (src.width ?? 0) >= 320)) bestThumb = src.url;
  }
  for (const ov of tv?.overlays ?? []) {
    const badge = ov.thumbnailBottomOverlayViewModel?.badges?.[0]?.thumbnailBadgeViewModel;
    if (badge?.text && /^\d+:\d\d/.test(badge.text)) duration = badge.text;
  }

  return {
    id,
    title,
    channel,
    duration,
    thumbnail: bestThumb || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    segmentIndex,
    segmentLabel,
  };
}

/* ── Scrape one playlist's first page ────────────────────── */

export async function fetchPlaylistItems(
  playlistId: string,
  segmentIndex: number,
  segmentLabel: string
): Promise<PlaylistItem[]> {
  const res = await fetch(
    `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`,
    {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    }
  );
  if (!res.ok) throw new Error(`YouTube returned ${res.status}`);
  const html = await res.text();

  const initialData = extractJsonAfter(html, "ytInitialData");
  if (!initialData) throw new Error("Could not parse playlist data");

  const lockups: Lockup[] = [];
  collectLockups(initialData, lockups);

  const items: PlaylistItem[] = [];
  const seen = new Set<string>();
  for (const lv of lockups) {
    const it = mapLockup(lv, segmentIndex, segmentLabel);
    if (it && !seen.has(it.id)) {
      seen.add(it.id);
      items.push(it);
    }
  }
  return items;
}

/* ── Single-video metadata via oEmbed ────────────────────── */

export async function fetchVideoMetas(
  videoIds: string[],
  segmentIndex: number,
  segmentLabel: string
): Promise<PlaylistItem[]> {
  const out: PlaylistItem[] = [];
  const queue = [...videoIds];

  async function worker() {
    while (queue.length > 0) {
      const id = queue.shift();
      if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) continue;
      try {
        const res = await fetch(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(
            `https://www.youtube.com/watch?v=${id}`
          )}&format=json`,
          { signal: AbortSignal.timeout(10_000), cache: "no-store" }
        );
        if (!res.ok) continue;
        const j = (await res.json()) as {
          title?: string;
          author_name?: string;
          thumbnail_url?: string;
        };
        if (!j.title) continue;
        out.push({
          id,
          title: j.title,
          channel: j.author_name ?? "",
          duration: "",
          thumbnail:
            j.thumbnail_url ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
          segmentIndex,
          segmentLabel,
        });
      } catch {
        /* skip unreachable videos */
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(5, queue.length) }, worker));

  const order = new Map(videoIds.map((id, i) => [id, i]));
  return out.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

/* ── Title-based dedupe (same song, different upload) ────── */

const NOISE_WORDS =
  /\b(ustad|nusrat|fateh|ali|khan|official|video|vidéo|hd|hq|full|song|songs|audio|lyrics|lyric|qawwali|qawali|kawali|best|of|hit|hits|live|version|complete|original|by|with|from|the|and|feat|ft|new|latest|evergreen|romantic|punjabi|devotional|collection|top)\b/g;

export function normalizeTitle(raw: string): string {
  return (raw || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[|·•–—_/\\]/g, " ")
    .replace(NOISE_WORDS, " ")
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, "")
    .trim();
}

export function dedupeByTitle(
  items: PlaylistItem[],
  priority: string[] = []
): PlaylistItem[] {
  const rank = new Map(priority.map((id, i) => [id, i]));
  const seen = new Map<string, PlaylistItem>();
  const out: PlaylistItem[] = [];

  for (const item of items) {
    const key = normalizeTitle(item.title);
    if (key.length < 3) {
      out.push(item);
      continue;
    }
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, item);
      out.push(item);
      continue;
    }
    const existingRank = rank.has(existing.id) ? 0 : 1;
    const incomingRank = rank.has(item.id) ? 0 : 1;
    if (incomingRank < existingRank) {
      seen.set(key, item);
      out.splice(out.indexOf(existing), 1, item);
    }
  }
  return out;
}
