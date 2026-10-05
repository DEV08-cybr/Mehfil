/**
 * Audius — free, ad-free, decentralised music streaming.
 * Public REST API, no API key required (app_name identifies the app).
 * Tracks stream through a direct audio URL, so playback uses a native
 * <audio> element — no iframe, no ads, no embed restrictions.
 */
import type { Track } from "./types";

const APP_NAME = "Mehfil";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** Stable aliases first, then known hosts as fallbacks. */
const HOSTS = [
  "https://discoveryprovider.audius.co",
  "https://discoveryprovider2.audius.co",
  "https://discoveryprovider3.audius.co",
];

const g = globalThis as typeof globalThis & {
  __mehfilAudiusHost?: { host: string; at: number };
};

const HOST_TTL = 30 * 60 * 1000;

function pickHost(): string {
  const cached = g.__mehfilAudiusHost;
  if (cached && Date.now() - cached.at < HOST_TTL) return cached.host;
  const host = HOSTS[0];
  g.__mehfilAudiusHost = { host, at: Date.now() };
  return host;
}

function markHost(host: string) {
  g.__mehfilAudiusHost = { host, at: Date.now() };
}

async function getJson<T>(path: string): Promise<T> {
  let lastError: unknown = null;
  // Try the preferred host first, then the fallbacks
  const ordered = [pickHost(), ...HOSTS.filter((h) => h !== pickHost())];
  for (const host of ordered) {
    try {
      const res = await fetch(`${host}${path}&app_name=${APP_NAME}`, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      });
      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status}`);
        continue;
      }
      markHost(host);
      return (await res.json()) as T;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError ?? new Error("Audius unavailable");
}

function fmt(seconds: number): string {
  if (!seconds || seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface AudiusTrack {
  id?: string;
  title?: string;
  duration?: number;
  is_original_available?: boolean;
  permalink?: string;
  artwork?: {
    "150x150"?: string;
    "480x480"?: string;
    "1000x1000"?: string;
  };
  user?: { name?: string; handle?: string };
}

export function audiusStreamUrl(id: string): string {
  return `${pickHost()}/v1/tracks/${id}/stream?app_name=${APP_NAME}`;
}

export function audiusTrack(raw: AudiusTrack): Track | null {
  const id = raw.id;
  if (!id || !raw.title) return null;
  // Audius keeps metadata for tracks whose audio file is no longer hosted,
  // so these look playable but error on stream. Only keep real ones.
  if (raw.is_original_available === false) return null;
  const art =
    raw.artwork?.["480x480"] ??
    raw.artwork?.["150x150"] ??
    raw.artwork?.["1000x1000"] ??
    "";
  return {
    key: `audius:${id}`,
    source: "audius",
    id,
    title: raw.title,
    artist: raw.user?.name || (raw.user?.handle ? `@${raw.user.handle}` : "Audius"),
    duration: fmt(raw.duration ?? 0),
    thumbnail: art.startsWith("https://") ? art : "",
    url: raw.permalink?.startsWith("http")
      ? raw.permalink
      : `https://audius.co${raw.permalink ?? ""}`,
  };
}

export async function searchAudius(query: string, limit = 8): Promise<Track[]> {
  const data = await getJson<{ data?: AudiusTrack[] }>(
    `/v1/tracks/search?query=${encodeURIComponent(query)}`
  );
  return (data.data ?? [])
    .map(audiusTrack)
    .filter((t): t is Track => t !== null)
    .slice(0, limit);
}