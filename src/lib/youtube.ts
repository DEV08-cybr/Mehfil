/**
 * Keyless YouTube helpers (server-side only).
 * Search scrapes the public results page; single videos resolve via oEmbed.
 */
import type { Track } from "./types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const HEADERS: Record<string, string> = {
  "User-Agent": UA,
  "Accept-Language": "en-US,en;q=0.9",
  // Skip the EU consent interstitial
  Cookie: "CONSENT=YES+1; SOCS=CAI",
};

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function youtubeTrack(
  id: string,
  title: string,
  artist: string,
  duration = ""
): Track {
  return {
    key: `youtube:${id}`,
    source: "youtube",
    id,
    title: title || "Untitled video",
    artist: artist || "YouTube",
    duration,
    thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
    url: `https://www.youtube.com/watch?v=${id}`,
  };
}

/** Extract the balanced JSON object that follows `marker` in an HTML page. */
function extractJsonAfter(html: string, marker: string): unknown | null {
  const at = html.indexOf(marker);
  if (at < 0) return null;
  const start = html.indexOf("{", at);
  if (start < 0) return null;

  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/** Depth-first walk that reports every (key, object) pair in document order. */
function walk(
  node: unknown,
  visit: (key: string, value: Record<string, unknown>) => void
): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const n of node) walk(n, visit);
    return;
  }
  const obj = node as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      visit(key, value as Record<string, unknown>);
    }
    walk(value, visit);
  }
}

type Runs = { runs?: Array<{ text?: string }>; simpleText?: string };

function textOf(t?: Runs): string {
  if (!t) return "";
  if (t.simpleText) return t.simpleText;
  return (t.runs ?? []).map((r) => r.text ?? "").join("");
}

interface VideoRenderer {
  videoId?: string;
  title?: Runs;
  ownerText?: Runs;
  longBylineText?: Runs;
  shortBylineText?: Runs;
  lengthText?: Runs;
}

interface Lockup {
  contentId?: string;
  contentType?: string;
  contentImage?: unknown;
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
}

export async function searchYouTube(query: string, limit = 8): Promise<Track[]> {
  // sp=EgIQAQ%3D%3D → "videos only"
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    query
  )}&sp=EgIQAQ%253D%253D&hl=en&gl=US`;

  const res = await fetch(url, {
    headers: HEADERS,
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`YouTube returned ${res.status}`);
  const html = await res.text();

  const data =
    extractJsonAfter(html, "var ytInitialData") ??
    extractJsonAfter(html, "ytInitialData");
  if (!data) throw new Error("Could not read YouTube results");

  const out: Track[] = [];
  const seen = new Set<string>();

  walk(data, (key, value) => {
    if (out.length >= limit) return;

    if (key === "videoRenderer") {
      const v = value as VideoRenderer;
      const id = v.videoId ?? "";
      const title = textOf(v.title);
      if (!VIDEO_ID.test(id) || seen.has(id) || !title) return;
      seen.add(id);
      out.push(
        youtubeTrack(
          id,
          title,
          textOf(v.ownerText) || textOf(v.longBylineText) || textOf(v.shortBylineText),
          textOf(v.lengthText)
        )
      );
      return;
    }

    if (key === "lockupViewModel") {
      const lv = value as Lockup;
      const id = lv.contentId ?? "";
      if (!VIDEO_ID.test(id) || seen.has(id)) return;
      if (lv.contentType && lv.contentType !== "LOCKUP_CONTENT_TYPE_VIDEO") return;
      const meta = lv.metadata?.lockupMetadataViewModel;
      const title = meta?.title?.content ?? "";
      if (!title) return;

      let channel = "";
      for (const row of meta?.metadata?.contentMetadataViewModel?.metadataRows ?? []) {
        for (const part of row.metadataParts ?? []) {
          const t = part.text?.content;
          if (t && !/^\d[\d:]*$/.test(t) && !/views|ago/i.test(t)) {
            channel = t;
            break;
          }
        }
        if (channel) break;
      }

      let duration = "";
      walk(lv.contentImage, (k, v) => {
        if (duration || k !== "thumbnailBadgeViewModel") return;
        const text = (v as { text?: string }).text;
        if (text && /^\d+:\d\d/.test(text)) duration = text;
      });

      seen.add(id);
      out.push(youtubeTrack(id, title, channel, duration));
    }
  });

  return out;
}

/** Pull a video id out of any common YouTube / YouTube Music URL. */
export function parseYouTubeId(input: string): string | null {
  const m = input
    .trim()
    .match(
      /(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i
    );
  return m ? m[1] : null;
}

export async function youtubeFromId(id: string): Promise<Track> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(
        `https://www.youtube.com/watch?v=${id}`
      )}`,
      { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8_000), cache: "no-store" }
    );
    if (res.ok) {
      const j = (await res.json()) as { title?: string; author_name?: string };
      return youtubeTrack(id, j.title ?? "", j.author_name ?? "");
    }
  } catch {
    /* fall through to a generic track */
  }
  return youtubeTrack(id, "YouTube video", "YouTube");
}
/* ── Playlist contents (keyless, scrapes the playlist page) ── */

interface PlaylistVideoRenderer {
  videoId?: string;
  title?: { runs?: Array<{ text?: string }>; simpleText?: string };
  shortBylineText?: { runs?: Array<{ text?: string }> };
  lengthText?: { simpleText?: string };
}

interface PlaylistLockup {
  contentId?: string;
  contentImage?: unknown;
  metadata?: {
    lockupMetadataViewModel?: {
      title?: { content?: string };
      metadata?: {
        contentMetadataViewModel?: {
          metadataRows?: Array<{ metadataParts?: Array<{ text?: { content?: string } }> }>;
        };
      };
    };
  };
}

function walkPlaylist(node: unknown, visit: (key: string, value: Record<string, unknown>) => void): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const n of node) walkPlaylist(n, visit);
    return;
  }
  const obj = node as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value && typeof value === "object" && !Array.isArray(value)) visit(key, value as Record<string, unknown>);
    walkPlaylist(value, visit);
  }
}

function ytText(t?: Runs): string {
  if (!t) return "";
  if (t.simpleText) return t.simpleText;
  return (t.runs ?? []).map((r) => r.text ?? "").join("");
}

export interface PlaylistEntry {
  id: string;
  title: string;
  channel: string;
  duration: string;
  thumbnail: string;
}

/** Read the first page of a public YouTube playlist. */
export async function fetchPlaylistEntries(playlistId: string): Promise<PlaylistEntry[]> {
  const res = await fetch(
    `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}&hl=en`,
    {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "en-US,en;q=0.9",
        Cookie: "CONSENT=YES+1; SOCS=CAI",
      },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    }
  );
  if (!res.ok) throw new Error(`YouTube returned ${res.status}`);
  const html = await res.text();

  const data = extractJsonAfter(html, "var ytInitialData") ?? extractJsonAfter(html, "ytInitialData");
  if (!data) throw new Error("Could not parse the playlist page");

  const out: PlaylistEntry[] = [];
  const seen = new Set<string>();

  walkPlaylist(data, (key, value) => {
    if (out.length >= 200) return;

    if (key === "playlistVideoRenderer") {
      const v = value as PlaylistVideoRenderer;
      const id = v.videoId ?? "";
      const title = ytText(v.title);
      if (!VIDEO_ID.test(id) || seen.has(id) || !title) return;
      seen.add(id);
      out.push({
        id,
        title,
        channel: ytText(v.shortBylineText),
        duration: v.lengthText?.simpleText ?? "",
        thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
      });
      return;
    }

    if (key === "lockupViewModel") {
      const lv = value as PlaylistLockup;
      const id = lv.contentId ?? "";
      if (!VIDEO_ID.test(id) || seen.has(id)) return;
      const meta = lv.metadata?.lockupMetadataViewModel;
      const title = meta?.title?.content ?? "";
      if (!title) return;
      let channel = "";
      for (const row of meta?.metadata?.contentMetadataViewModel?.metadataRows ?? []) {
        for (const part of row.metadataParts ?? []) {
          const t = part.text?.content;
          if (t && !/^\d[\d:]*$/.test(t) && !/views|ago/i.test(t)) {
            channel = t;
            break;
          }
        }
        if (channel) break;
      }
      seen.add(id);
      out.push({
        id,
        title,
        channel,
        duration: "",
        thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
      });
    }
  });

  return out;
}
