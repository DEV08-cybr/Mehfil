"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import * as I from "@/components/icons";
import { audiusStreamUrl } from "@/lib/audius";
import { DISCOVER_MOODS, SITE, SOCIAL_LINKS, type Mood, type SocialId } from "@/lib/config";
import type { Source, Track } from "@/lib/types";

/* ================================================================
   External player typings (official YouTube IFrame API + SC Widget)
   ================================================================ */

interface YTPlayer {
  loadVideoById: (opts: { videoId: string; startSeconds?: number }) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume: (volume: number) => void;
  mute: () => void;
  unMute: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

interface YTPlayer {
  loadVideoById: (opts: { videoId: string; startSeconds?: number }) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume: (volume: number) => void;
  mute: () => void;
  unMute: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer };
    onYouTubeIframeAPIReady?: () => void;
  }
}

/* ================================================================
   Types & helpers
   ================================================================ */

type Repeat = "off" | "all" | "one";
type SideTab = "queue" | "feed" | "devices";
type MobileTab = "discover" | SideTab;
type ToastKind = "info" | "error" | "success";
type CommandAction = "play" | "pause" | "next" | "prev" | "seek" | "volume" | "playTrack" | "enqueue";

interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
  report?: boolean;
}

interface SearchResponse {
  results?: unknown[];
  source?: "audius" | "youtube" | "link";
  fallback?: boolean;
  error?: string;
}

interface HostSnapshot {
  track: Track | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  volume: number;
  muted: boolean;
  queue: Track[];
}

interface RemoteState extends HostSnapshot {
  receivedAt: number;
  elapsed: number;
}

interface Handlers {
  play: () => void;
  pause: () => void;
  toggle: () => void;
  next: (auto?: boolean) => void;
  prev: () => void;
  toggleMute: () => void;
  pauseLocal: () => void;
  join: (code: string) => Promise<void>;
  runCommand: (action: string, payload: unknown) => void;
  onYtReady: () => void;
  onYtState: (state: number) => void;
  onEngineError: (source: Source, code: number) => void;
}

const LS_PREFIX = "mehfil:v1:";
const JSON_HEADERS = { "Content-Type": "application/json" };
const SC_PARAMS =
  "auto_play=true&visual=true&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&buying=false&sharing=false&download=false";

const YT_ERRORS: Record<number, string> = {
  2: "That video link looks invalid.",
  5: "YouTube's player hit an error on this video.",
  100: "This video was removed or is private.",
  101: "The uploader blocked this video from playing on other sites.",
  150: "The uploader blocked this video from playing on other sites.",
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "0:00";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

function safe(fn: () => void) {
  try {
    fn();
  } catch {
    /* engine not ready yet */
  }
}

function isTrack(x: unknown): x is Track {
  if (!x || typeof x !== "object") return false;
  const t = x as Record<string, unknown>;
  const strings = ["key", "id", "title", "artist", "duration", "thumbnail", "url"];
  if (!strings.every((k) => typeof t[k] === "string")) return false;
  if (t.source === "youtube") return /^[A-Za-z0-9_-]{11}$/.test(t.id as string);
  if (t.source === "audius") return /^[A-Za-z0-9]{6,}$/.test(t.id as string);
  return false;
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage full or blocked */
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "1") return resolve();
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("script failed")));
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => {
      s.dataset.loaded = "1";
      resolve();
    };
    s.onerror = () => reject(new Error("script failed"));
    document.head.appendChild(s);
  });
}

function whenYouTubeReady(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.YT?.Player) return resolve();
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    loadScript("https://www.youtube.com/iframe_api").catch(reject);
  });
}

function deviceLabel(ua: string): string {
  const os = /iPhone/i.test(ua)
    ? "iPhone"
    : /iPad/i.test(ua)
      ? "iPad"
      : /Android/i.test(ua)
        ? /Mobile/i.test(ua)
          ? "Android phone"
          : "Android tablet"
        : /Macintosh|Mac OS X/i.test(ua)
          ? "Mac"
          : /Windows/i.test(ua)
            ? "Windows PC"
            : /CrOS/i.test(ua)
              ? "Chromebook"
              : /Linux/i.test(ua)
                ? "Linux computer"
                : "This browser";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "";
  return browser ? `${os} · ${browser}` : os;
}

function parseRemote(raw: unknown, serverNow?: number, updatedAt?: number): RemoteState | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  return {
    track: isTrack(s.track) ? s.track : null,
    isPlaying: s.isPlaying === true,
    position: num(s.position),
    duration: num(s.duration),
    volume: clamp(num(s.volume, 80), 0, 100),
    muted: s.muted === true,
    queue: Array.isArray(s.queue) ? s.queue.filter(isTrack).slice(0, 25) : [],
    receivedAt: Date.now(),
    elapsed:
      serverNow && updatedAt ? clamp((serverNow - updatedAt) / 1000, 0, 10) : 0,
  };
}

function searchNoteFrom(count: number, error?: string, fallback = false): string | null {
  if (count === 0) return "No results — try different words, or paste a YouTube link.";
  if (fallback) {
    return "No ad-free matches on Audius — showing YouTube results (YouTube may show its own ads).";
  }
  if (error) return "Search failed — check your connection and try again.";
  return null;
}

/* ================================================================
   Small presentational pieces
   ================================================================ */

function SourceBadge({ source }: { source: Source }) {
  const label = source === "youtube" ? "YT" : "AU";
  return <span className={`badge ${source === "youtube" ? "yt" : "au"}`}>{label}</span>;
}

function SocialIcon({ id }: { id: SocialId }) {
  switch (id) {
    case "spotify":
      return <I.ISpotify size={17} />;
    case "youtube":
      return <I.IYouTube size={18} />;
    case "instagram":
      return <I.IInstagram size={17} />;
    case "linkedin":
      return <I.ILinkedIn size={15} />;
    default:
      return <I.IGitHub size={17} />;
  }
}

function Skeleton({ rows }: { rows: number }) {
  return (
    <div aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skel" />
      ))}
    </div>
  );
}

interface RowProps {
  t: Track;
  active?: boolean;
  playing?: boolean;
  liked?: boolean;
  onPlay: () => void;
  onQueue?: () => void;
  onNext?: () => void;
  onLike?: () => void;
  onRemove?: () => void;
  onUp?: () => void;
  onDown?: () => void;
}

function TrackRow({ t, active, playing, liked, onPlay, onQueue, onNext, onLike, onRemove, onUp, onDown }: RowProps) {
  return (
    <div className={`row${active ? " is-active" : ""}`}>
      <button type="button" className="row-main" onClick={onPlay} title={`Play “${t.title}”`}>
        <span className="row-art">
          {t.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={t.thumbnail}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.style.visibility = "hidden";
              }}
            />
          ) : (
            <I.IMusic size={16} className="row-art-fallback" />
          )}
          {active && playing ? (
            <span className="row-eq" aria-hidden>
              <i />
              <i />
              <i />
            </span>
          ) : (
            <span className="row-play" aria-hidden>
              <I.IPlay size={14} />
            </span>
          )}
        </span>
        <span className="row-text">
          <span className="row-title">{t.title}</span>
          <span className="row-sub">
            <SourceBadge source={t.source} />
            <span className="row-sub-text">
              {t.artist}
              {t.duration ? ` · ${t.duration}` : ""}
            </span>
          </span>
        </span>
      </button>
      <div className="row-actions">
        {onLike && (
          <button
            type="button"
            className={`act${liked ? " on" : ""}`}
            onClick={onLike}
            title={liked ? "Remove from Liked" : "Save to Liked (feed)"}
            aria-label={liked ? "Unlike" : "Like"}
          >
            <I.IHeart size={15} filled={liked} />
          </button>
        )}
        {onNext && (
          <button type="button" className="act" onClick={onNext} title="Play next" aria-label="Play next">
            <I.IPlayNext size={16} />
          </button>
        )}
        {onQueue && (
          <button type="button" className="act" onClick={onQueue} title="Add to queue" aria-label="Add to queue">
            <I.IQueueAdd size={16} />
          </button>
        )}
        {onUp && (
          <button type="button" className="act" onClick={onUp} title="Move up" aria-label="Move up">
            <I.IUp size={15} />
          </button>
        )}
        {onDown && (
          <button type="button" className="act" onClick={onDown} title="Move down" aria-label="Move down">
            <I.IDown size={15} />
          </button>
        )}
        {onRemove && (
          <button type="button" className="act" onClick={onRemove} title="Remove from queue" aria-label="Remove">
            <I.IClose size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ================================================================
   Main player
   ================================================================ */

export default function MehfilPlayer() {
  /* ── Library ── */
  const [current, setCurrent] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [history, setHistory] = useState<Track[]>([]);
  const [context, setContext] = useState<Track[]>([]);
  const [feed, setFeed] = useState<Track[]>([]);
  const [liked, setLiked] = useState<Track[]>([]);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<Repeat>("off");

  /* ── Playback ── */
  const [engine, setEngine] = useState<Source | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [muted, setMuted] = useState(false);
  const [scrub, setScrub] = useState<number | null>(null);

  /* ── Search ── */
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [playlistError, setPlaylistError] = useState<string | null>(null);
  const [imported, setImported] = useState<{ label: string; tracks: Track[] }[]>([]);

  /* ── Discover ── */
  const [mood, setMood] = useState<Mood>(DISCOVER_MOODS[0]);
  const [discover, setDiscover] = useState<Track[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(true);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [discoverFallback, setDiscoverFallback] = useState(false);
  const [discoverNonce, setDiscoverNonce] = useState(0);

  /* ── UI ── */
  const [sideTab, setSideTab] = useState<SideTab>("queue");
  const [mobileTab, setMobileTab] = useState<MobileTab>("discover");
  const [helpOpen, setHelpOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [device, setDevice] = useState("This browser");
  const [origin, setOrigin] = useState("");
  const [linkBase, setLinkBase] = useState("");
  const [editingBase, setEditingBase] = useState(false);

  /* ── Device connection ── */
  const [hostCode, setHostCode] = useState<string | null>(null);
  const [remoteCode, setRemoteCode] = useState<string | null>(null);
  const [remoteState, setRemoteState] = useState<RemoteState | null>(null);
  const [joinInput, setJoinInput] = useState("");
  const [persistentSync, setPersistentSync] = useState<boolean | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [, setTick] = useState(0);

  /* ── Refs ── */
  const ytHostRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytRef = useRef<YTPlayer | null>(null);
  const ytReadyRef = useRef(false);
  const ytPendingRef = useRef<string | null>(null);
  const engineRef = useRef<Source | null>(null);
  const nextRef = useRef<(auto?: boolean) => void>(() => {});
  const onEndedRef = useRef<() => void>(() => {});
  const loadedKeyRef = useRef<string | null>(null);
  const playIntentRef = useRef(false);
  const errorStreakRef = useRef(0);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const toastSeq = useRef(0);
  const volumeTimer = useRef<number | undefined>(undefined);
  const volumeRef = useRef({ volume: 80, muted: false });
  const snapshotRef = useRef<HostSnapshot>({
    track: null,
    isPlaying: false,
    position: 0,
    duration: 0,
    volume: 80,
    muted: false,
    queue: [],
  });
  const handlers = useRef<Handlers>({} as Handlers);

  engineRef.current = engine;
  volumeRef.current = { volume, muted };
  snapshotRef.current = {
    track: current,
    isPlaying,
    position,
    duration,
    volume,
    muted,
    queue: queue.slice(0, 25),
  };

  const likedKeys = useMemo(() => new Set(liked.map((t) => t.key)), [liked]);

  /* ── Toasts ── */
  const notify = useCallback((text: string, kind: ToastKind = "info", report = false) => {
    const id = ++toastSeq.current;
    setToasts((list) => [...list.slice(-3), { id, kind, text, report }]);
    window.setTimeout(
      () => setToasts((list) => list.filter((x) => x.id !== id)),
      kind === "error" ? 7000 : 3800
    );
  }, []);

  /* ================================================================
     Effects: hydrate, persist, engines, search, discover, sync
     ================================================================ */

  useEffect(() => {
    setLiked(load<unknown[]>("liked", []).filter(isTrack));
    setFeed(load<unknown[]>("feed", []).filter(isTrack));
    setQueue(load<unknown[]>("queue", []).filter(isTrack));
    const saved = load<unknown>("current", null);
    if (isTrack(saved)) setCurrent(saved);
    const v = Number(load<number>("volume", 80));
    setVolume(Number.isFinite(v) ? clamp(v, 0, 100) : 80);
    setShuffle(load<boolean>("shuffle", false) === true);
    const r = load<string>("repeat", "off");
    setRepeat(r === "all" || r === "one" ? r : "off");
    const envBase = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    const savedBase = load<string>("linkBase", "");
    const auto = window.location.origin;
    setOrigin(auto);
    setLinkBase(String(savedBase || envBase || auto).replace(/\/+$/, ""));
    setDevice(deviceLabel(navigator.userAgent));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    save("liked", liked);
    save("feed", feed);
    save("queue", queue);
    save("current", current);
    save("volume", volume);
    save("shuffle", shuffle);
    save("repeat", repeat);
  }, [hydrated, liked, feed, queue, current, volume, shuffle, repeat]);

  // YouTube engine (official IFrame API, rendered visibly in the Now Playing card)
  useEffect(() => {
    let cancelled = false;
    whenYouTubeReady()
      .then(() => {
        if (cancelled || ytRef.current || !ytHostRef.current || !window.YT) return;
        const mount = document.createElement("div");
        ytHostRef.current.appendChild(mount);
        ytRef.current = new window.YT.Player(mount, {
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 0,
            controls: 1,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            iv_load_policy: 3,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              ytReadyRef.current = true;
              handlers.current.onYtReady();
            },
            onStateChange: (e: { data: number }) => handlers.current.onYtState(e.data),
            onError: (e: { data: number }) => handlers.current.onEngineError("youtube", e.data),
          },
        });
      })
      .catch(() =>
        notify("Couldn't reach YouTube. Check your connection or allow youtube.com in your blocker.", "error", true)
      );
    return () => {
      cancelled = true;
    };
  }, [notify]);

  // YouTube position polling
  useEffect(() => {
    const t = window.setInterval(() => {
      if (engineRef.current !== "youtube" || !ytReadyRef.current || !ytRef.current) return;
      safe(() => {
        const p = ytRef.current!.getCurrentTime();
        const d = ytRef.current!.getDuration();
        if (Number.isFinite(p)) setPosition(p);
        if (d > 0) setDuration(d);
      });
    }, 500);
    return () => window.clearInterval(t);
  }, []);

  // Audius (native <audio>) events
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => {
      if (engineRef.current !== "audius") return;
      setPosition(el.currentTime);
    };
    const onMeta = () => {
      if (engineRef.current !== "audius") return;
      if (el.duration > 0) setDuration(el.duration);
    };
    const onPlay = () => {
      if (engineRef.current !== "audius") return;
      setIsPlaying(true);
      setBuffering(false);
      errorStreakRef.current = 0;
    };
    const onPause = () => {
      if (engineRef.current !== "audius") return;
      setIsPlaying(false);
    };
    const onEnded = () => {
      if (engineRef.current !== "audius") return;
      setIsPlaying(false);
      setPosition(0);
      onEndedRef.current();
    };
    const onError = () => {
      if (engineRef.current !== "audius") return;
      errorStreakRef.current += 1;
      if (errorStreakRef.current <= 5) {
        notify("Audius couldn't play this track. Skipping to the next one…", "error");
        window.setTimeout(() => nextRef.current(true), 700);
      } else {
        setIsPlaying(false);
        notify("Several Audius tracks failed — check your connection or try YouTube results.", "error", true);
      }
    };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("durationchange", onMeta);
    el.addEventListener("play", onPlay);
    el.addEventListener("playing", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    el.addEventListener("error", onError);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("durationchange", onMeta);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("playing", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("error", onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notify]);

  // Apply volume to both engines
  useEffect(() => {
    safe(() => {
      const yt = ytRef.current;
      if (!ytReadyRef.current || !yt) return;
      yt.setVolume(volume);
      if (muted) yt.mute();
      else yt.unMute();
    });
  }, [volume, muted]);

  // Search (debounced)
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearchNote(null);
      setSearching(false);
      return;
    }
    const ctrl = new AbortController();
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q)}&limit=5`,
          { signal: ctrl.signal }
        );
        if (res.status === 429) {
          setResults([]);
          setSearchNote("You're searching very fast — wait a few seconds and try again.");
          return;
        }
        const data = (await res.json()) as SearchResponse;
        const list = (data.results ?? []).filter(isTrack);
        setResults(list);
        setSearchNote(searchNoteFrom(list.length, data.error, data.fallback === true));
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setResults([]);
          setSearchNote("Search failed — check your internet connection and try again.");
        }
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, 380);
    return () => {
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  // Discover feed
  useEffect(() => {
    const ctrl = new AbortController();
    setDiscoverLoading(true);
    setDiscoverError(null);
    fetch(`/api/search?q=${encodeURIComponent(mood.query)}&limit=14`, {
      signal: ctrl.signal,
    })
      .then((r) => r.json() as Promise<SearchResponse>)
      .then((d) => {
        const list = (d.results ?? []).filter(isTrack);
        setDiscover(list);
        setDiscoverFallback(d.fallback === true);
        if (list.length === 0) {
          setDiscoverError("Nothing came back for this mood. Try another one or retry.");
        }
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setDiscoverError("Couldn't load Discover. Check your connection and retry.");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setDiscoverLoading(false);
      });
    return () => ctrl.abort();
  }, [mood, discoverNonce]);

  // Close search results when clicking elsewhere
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName ?? "";
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !!el?.isContentEditable;
      if (e.key === "Escape") {
        setHelpOpen(false);
        setSearchOpen(false);
        setAddOpen(false);
        return;
      }
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (typing) return;
      if (e.key === " " && tag !== "BUTTON" && tag !== "A") {
        e.preventDefault();
        handlers.current.toggle();
      } else if (e.key === "ArrowRight" && e.shiftKey) handlers.current.next();
      else if (e.key === "ArrowLeft" && e.shiftKey) handlers.current.prev();
      else if (e.key === "m" || e.key === "M") handlers.current.toggleMute();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Media keys / lock-screen controls where the browser supports them
  useEffect(() => {
    if (!current || typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    safe(() => {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: current.title,
        artist: current.artist,
        album: "Mehfil",
        artwork: current.thumbnail ? [{ src: current.thumbnail, sizes: "320x180", type: "image/jpeg" }] : [],
      });
      navigator.mediaSession.setActionHandler("play", () => handlers.current.play());
      navigator.mediaSession.setActionHandler("pause", () => handlers.current.pause());
      navigator.mediaSession.setActionHandler("previoustrack", () => handlers.current.prev());
      navigator.mediaSession.setActionHandler("nexttrack", () => handlers.current.next());
    });
  }, [current]);

  // Remote mode: poll the host's state
  useEffect(() => {
    if (!remoteCode) return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/connect?code=${remoteCode}&role=remote`, { cache: "no-store" });
        if (r.status === 404) {
          if (!stop) {
            notify("That session ended on the other device.", "error");
            setRemoteCode(null);
            setRemoteState(null);
          }
          return;
        }
        if (!r.ok) return;
        const d = (await r.json()) as { state?: unknown; updatedAt?: number; serverNow?: number; persistent?: boolean };
        if (stop) return;
        if (typeof d.persistent === "boolean") setPersistentSync(d.persistent);
        setRemoteState(parseRemote(d.state, d.serverNow, d.updatedAt));
      } catch {
        /* transient network error — keep polling */
      }
    };
    void tick();
    const timer = window.setInterval(tick, 1500);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [remoteCode, notify]);

  // Smooth progress while controlling a remote device
  useEffect(() => {
    if (!remoteCode) return;
    const t = window.setInterval(() => setTick((n) => n + 1), 500);
    return () => window.clearInterval(t);
  }, [remoteCode]);

  // Host mode: push state + consume remote commands
  useEffect(() => {
    if (!hostCode) return;
    let stop = false;
    const push = async () => {
      try {
        const r = await fetch("/api/connect", {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify({ action: "state", code: hostCode, state: snapshotRef.current }),
        });
        if (r.status === 404 && !stop) {
          notify("Your device session expired. Start a new one any time.");
          setHostCode(null);
        }
      } catch {
        /* retry on next tick */
      }
    };
    const poll = async () => {
      try {
        const r = await fetch(`/api/connect?code=${hostCode}&role=host`, { cache: "no-store" });
        if (r.status === 404) {
          if (!stop) setHostCode(null);
          return;
        }
        if (!r.ok) return;
        const d = (await r.json()) as { commands?: Array<{ action?: string; payload?: unknown }> };
        for (const c of d.commands ?? []) {
          if (typeof c.action === "string") handlers.current.runCommand(c.action, c.payload);
        }
      } catch {
        /* retry on next tick */
      }
    };
    void push();
    const a = window.setInterval(push, 2000);
    const b = window.setInterval(poll, 1200);
    return () => {
      stop = true;
      window.clearInterval(a);
      window.clearInterval(b);
    };
  }, [hostCode, notify]);

  // Push immediately on meaningful changes while hosting
  const currentKey = current?.key;
  useEffect(() => {
    if (!hostCode) return;
    void fetch("/api/connect", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ action: "state", code: hostCode, state: snapshotRef.current }),
    }).catch(() => undefined);
  }, [hostCode, currentKey, isPlaying, queue.length]);

  // ?connect=CODE (from a QR code / shared link) joins as a remote
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("connect");
    if (code) {
      setSideTab("devices");
      setMobileTab("devices");
      void handlers.current.join(code);
    }
  }, []);

  /* ================================================================
     Engine control
     ================================================================ */

  function startTrack(t: Track) {
    playIntentRef.current = true;
    loadedKeyRef.current = t.key;
    setPosition(0);
    setDuration(0);
    setBuffering(true);
    if (t.source === "youtube") {
      engineRef.current = "youtube";
      setEngine("youtube");
      if (ytReadyRef.current && ytRef.current) {
        safe(() => ytRef.current?.loadVideoById({ videoId: t.id, startSeconds: 0 }));
      } else {
        ytPendingRef.current = t.id;
      }
    } else {
      // Audius streams a direct audio URL — native <audio>, no iframe, no ads
      safe(() => ytRef.current?.pauseVideo());
      engineRef.current = "audius";
      setEngine("audius");
      const el = audioRef.current;
      if (el) {
        el.src = audiusStreamUrl(t.id);
        el.load();
        void el.play().then(
          () => setIsPlaying(true),
          () => notify("Audius couldn't start this track. Try another result.", "error", true)
        );
      }
    }
  }

  function sendCommand(action: CommandAction, payload?: unknown) {
    const code = remoteCode;
    if (!code) return;
    fetch("/api/connect", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ action: "command", code, command: { action, payload } }),
    })
      .then((r) => {
        if (r.status === 404) {
          notify("That session has ended on the other device.", "error");
          setRemoteCode(null);
          setRemoteState(null);
        } else if (!r.ok) {
          notify("The other device didn't accept that — try again.", "error");
        }
      })
      .catch(() => notify("Couldn't reach the other device. Check your connection.", "error"));
  }

  /* ================================================================
     Queue & transport actions
     ================================================================ */

  function addToFeed(t: Track) {
    setFeed((f) => [t, ...f.filter((x) => x.key !== t.key)].slice(0, 40));
  }

  function playNow(t: Track, ctx?: Track[]) {
    setSearchOpen(false);
    if (remoteCode) {
      sendCommand("playTrack", t);
      notify(`Playing on the connected device · ${t.title}`, "success");
      return;
    }
    if (current && current.key !== t.key) {
      const previous = current;
      setHistory((h) => [...h.filter((x) => x.key !== previous.key), previous].slice(-50));
    }
    setCurrent(t);
    setQueue((q) => q.filter((x) => x.key !== t.key));
    if (ctx) setContext(ctx);
    addToFeed(t);
    startTrack(t);
  }

  function enqueue(t: Track, silent = false) {
    if (remoteCode) {
      sendCommand("enqueue", t);
      if (!silent) notify("Added to the connected device's queue", "success");
      return;
    }
    if (!current) {
      playNow(t);
      return;
    }
    setQueue((q) => (q.some((x) => x.key === t.key) || current.key === t.key ? q : [...q, t]));
    if (!silent) notify(`Added to queue · ${t.title}`, "success");
  }

  function enqueueMany(list: Track[]) {
    if (list.length === 0) return;
    if (remoteCode) {
      list.slice(0, 15).forEach((t) => sendCommand("enqueue", t));
      notify(`Sent ${Math.min(list.length, 15)} tracks to the connected device`, "success");
      return;
    }
    setQueue((q) => {
      const keys = new Set(q.map((x) => x.key));
      if (current) keys.add(current.key);
      return [...q, ...list.filter((t) => !keys.has(t.key))];
    });
    notify(`Added ${list.length} tracks to the queue`, "success");
  }

  /* ── Import a YouTube playlist into the archive ───────── */

  async function importPlaylist() {
    const url = playlistUrl.trim();
    if (url.length < 8) {
      setPlaylistError("Paste a YouTube playlist link (it contains list=…).");
      return;
    }
    setPlaylistLoading(true);
    setPlaylistError(null);
    try {
      const res = await fetch(`/api/playlist?list=${encodeURIComponent(url)}`);
      const data: { error?: string; count?: number; tracks?: unknown[] } = await res.json();
      if (!res.ok || !data.tracks) {
        setPlaylistError(data.error ?? "Couldn't import that playlist.");
        return;
      }
      const tracks = data.tracks.filter(isTrack);
      if (tracks.length === 0) {
        setPlaylistError("That playlist has no playable tracks.");
        return;
      }
      setImported((prev) => [
        { label: `Imported playlist ${prev.length + 1}`, tracks },
        ...prev,
      ]);
      setPlaylistUrl("");
      setPlaylistError(null);
      setAddOpen(false);
      // Fill the queue with the whole playlist, then start the first track
      enqueueMany(tracks);
      playNow(tracks[0], tracks);
      notify(`Imported ${tracks.length} tracks — playing now.`, "success");
    } catch {
      setPlaylistError("Network error — check your connection and try again.");
    } finally {
      setPlaylistLoading(false);
    }
  }

  function removeImported(label: string) {
    setImported((prev) => prev.filter((p) => p.label !== label));
  }

  function playNext(t: Track) {
    if (remoteCode) {
      sendCommand("enqueue", t);
      notify("Added to the connected device's queue", "success");
      return;
    }
    if (!current) {
      playNow(t);
      return;
    }
    setQueue((q) => [t, ...q.filter((x) => x.key !== t.key)]);
    notify(`Playing next · ${t.title}`, "success");
  }

  function removeAt(i: number) {
    setQueue((q) => q.filter((_, idx) => idx !== i));
  }

  function move(i: number, dir: -1 | 1) {
    setQueue((q) => {
      const j = i + dir;
      if (j < 0 || j >= q.length) return q;
      const copy = [...q];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  function seekLocal(sec: number) {
    const s = Math.max(0, sec);
    if (engineRef.current === "youtube") safe(() => ytRef.current?.seekTo(s, true));
    else if (engineRef.current === "audius") safe(() => (audioRef.current!.currentTime = s));
    setPosition(s);
  }

  function seekTo(sec: number) {
    if (remoteCode) {
      sendCommand("seek", sec);
      return;
    }
    seekLocal(sec);
  }

  function restart() {
    seekLocal(0);
    if (engineRef.current === "youtube") safe(() => ytRef.current?.playVideo());
    else if (engineRef.current === "audius") safe(() => audioRef.current?.play());
  }

  function play() {
    if (remoteCode) {
      sendCommand("play");
      return;
    }
    if (!current) {
      const first = queue[0] ?? discover[0];
      if (first) playNow(first, queue[0] ? undefined : discover);
      else notify("Search for something, or pick a mood in Discover.");
      return;
    }
    playIntentRef.current = true;
    if (loadedKeyRef.current !== current.key) {
      startTrack(current);
      return;
    }
    if (engineRef.current === "youtube") safe(() => ytRef.current?.playVideo());
    else if (engineRef.current === "audius") {
      const el = audioRef.current;
      if (el && !el.src) el.src = audiusStreamUrl(current.id);
      void el?.play().then(
        () => setIsPlaying(true),
        () => notify("Audius couldn't start this track. Try another result.", "error", true)
      );
    }
  }

  function pauseLocal() {
    playIntentRef.current = false;
    safe(() => ytRef.current?.pauseVideo());
    safe(() => audioRef.current?.pause());
    setIsPlaying(false);
  }

  function pause() {
    if (remoteCode) {
      sendCommand("pause");
      return;
    }
    pauseLocal();
  }

  function toggle() {
    if (remoteCode) {
      sendCommand(remoteState?.isPlaying ? "pause" : "play");
      return;
    }
    if (isPlaying) pause();
    else play();
  }

  function next(auto = false) {
    if (remoteCode) {
      sendCommand("next");
      return;
    }
    if (queue.length > 0) {
      const idx = shuffle ? Math.floor(Math.random() * queue.length) : 0;
      playNow(queue[idx]);
      return;
    }
    if (context.length > 0) {
      const i = current ? context.findIndex((x) => x.key === current.key) : -1;
      let candidate: Track | undefined;
      if (shuffle && context.length > 1) {
        const pool = context.filter((x) => x.key !== current?.key);
        candidate = pool[Math.floor(Math.random() * pool.length)];
      } else {
        candidate = context[i + 1] ?? (repeat === "all" ? context[0] : undefined);
      }
      if (candidate) {
        playNow(candidate);
        return;
      }
    }
    if (repeat === "all" && current) {
      restart();
      return;
    }
    if (auto) {
      setIsPlaying(false);
      notify("That's the end of your queue — pick a mood in Discover to keep the mehfil going.");
    } else {
      notify("Your queue is empty — add tracks from search or Discover.");
    }
  }

  function prev() {
    if (remoteCode) {
      sendCommand("prev");
      return;
    }
    if (position > 3 || history.length === 0) {
      seekLocal(0);
      return;
    }
    const previous = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    if (current) {
      const cur = current;
      setQueue((q) => [cur, ...q.filter((x) => x.key !== cur.key)]);
    }
    setCurrent(previous);
    addToFeed(previous);
    startTrack(previous);
  }

  function onEnded() {
    if (repeat === "one") restart();
    else next(true);
  }
  nextRef.current = next;
  onEndedRef.current = onEnded;

  function changeVolume(v: number) {
    const value = clamp(Math.round(v), 0, 100);
    if (remoteCode) {
      window.clearTimeout(volumeTimer.current);
      volumeTimer.current = window.setTimeout(() => sendCommand("volume", value), 250);
      return;
    }
    setVolume(value);
    if (value > 0 && muted) setMuted(false);
  }

  function toggleMute() {
    if (remoteCode) {
      sendCommand("volume", (remoteState?.volume ?? 0) > 0 ? 0 : 70);
      return;
    }
    if (volume === 0) {
      setVolume(60);
      setMuted(false);
    } else setMuted((m) => !m);
  }

  function toggleLike(t: Track) {
    const wasLiked = likedKeys.has(t.key);
    setLiked((l) => (wasLiked ? l.filter((x) => x.key !== t.key) : [t, ...l].slice(0, 300)));
    if (!wasLiked) notify("Saved to your feed ♥", "success");
  }

  function runCommand(action: string, payload: unknown) {
    switch (action) {
      case "play":
        play();
        break;
      case "pause":
        pause();
        break;
      case "next":
        next();
        break;
      case "prev":
        prev();
        break;
      case "seek":
        if (typeof payload === "number") seekLocal(payload);
        break;
      case "volume":
        if (typeof payload === "number") {
          const v = clamp(Math.round(payload), 0, 100);
          setVolume(v);
          if (v > 0) setMuted(false);
        }
        break;
      case "playTrack":
        if (isTrack(payload)) playNow(payload);
        break;
      case "enqueue":
        if (isTrack(payload)) {
          enqueue(payload, true);
          notify(`A connected device queued · ${payload.title}`);
        }
        break;
    }
  }

  /* ── Device sessions ── */

  async function startSession() {
    if (remoteCode) return;
    setConnecting(true);
    try {
      const r = await fetch("/api/connect", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ action: "create" }),
      });
      const d = (await r.json()) as { code?: string; persistent?: boolean };
      if (!r.ok || !d.code) throw new Error("create failed");
      setHostCode(d.code);
      setPersistentSync(typeof d.persistent === "boolean" ? d.persistent : null);
      notify("Session started — scan the QR or open the link on another device.", "success");
    } catch {
      notify("Couldn't start a device session. Please try again.", "error", true);
    } finally {
      setConnecting(false);
    }
  }

  function endSession() {
    setHostCode(null);
    notify("Device session ended.");
  }

  async function joinSession(raw: string) {
    const code = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length !== 6) {
      notify("Session codes are 6 letters/numbers — check the other device.", "error");
      return;
    }
    if (hostCode) {
      notify("End your own session before controlling another device.", "error");
      return;
    }
    setConnecting(true);
    try {
      const r = await fetch(`/api/connect?code=${code}&role=remote`, { cache: "no-store" });
      if (r.status === 404) {
        notify("No session with that code. Check the code on the other device.", "error");
        return;
      }
      if (!r.ok) throw new Error("join failed");
      pauseLocal();
      setRemoteCode(code);
      setJoinInput("");
      notify(`Connected — this device now controls ${code}.`, "success");
    } catch {
      notify("Couldn't connect. Check your internet and try again.", "error", true);
    } finally {
      setConnecting(false);
    }
  }

  function leaveRemote() {
    setRemoteCode(null);
    setRemoteState(null);
    if (window.location.search.includes("connect=")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
    notify("Disconnected from the other device.");
  }

  function copyText(text: string) {
    if (!navigator.clipboard) {
      notify("Copy isn't available here — select the link and copy it manually.");
      return;
    }
    navigator.clipboard
      .writeText(text)
      .then(() => notify("Link copied", "success"))
      .catch(() => notify("Couldn't copy — select the link and copy it manually.", "error"));
  }

  function openSide(tab: SideTab) {
    setSideTab(tab);
    setMobileTab(tab);
  }

  /* ── Engine callbacks (always read the latest closures) ── */
  handlers.current = {
    play,
    pause,
    toggle,
    next,
    prev,
    toggleMute,
    pauseLocal,
    join: joinSession,
    runCommand,
    onYtReady: () => {
      safe(() => {
        const yt = ytRef.current;
        if (!yt) return;
        yt.setVolume(volumeRef.current.volume);
        if (volumeRef.current.muted) yt.mute();
      });
      const pending = ytPendingRef.current;
      if (pending) {
        ytPendingRef.current = null;
        safe(() => ytRef.current?.loadVideoById({ videoId: pending, startSeconds: 0 }));
      }
    },
    onYtState: (s) => {
      if (engineRef.current !== "youtube") return;
      if (s === 1) {
        setIsPlaying(true);
        setBuffering(false);
        errorStreakRef.current = 0;
      } else if (s === 2) {
        setIsPlaying(false);
        setBuffering(false);
      } else if (s === 3) {
        setBuffering(true);
      } else if (s === 0) {
        setIsPlaying(false);
        setBuffering(false);
        onEnded();
      } else if (s === 5) {
        setBuffering(false);
      }
    },
    onEngineError: (source, code) => {
      if (engineRef.current !== source) return;
      setBuffering(false);
      errorStreakRef.current += 1;
      const msg =
        source === "youtube"
          ? YT_ERRORS[code] ?? "YouTube couldn't play this video."
          : "Audius couldn't play this track.";
      if (errorStreakRef.current <= 5) {
        notify(`${msg} Skipping to the next one…`, "error");
        window.setTimeout(() => handlers.current.next(true), 700);
      } else {
        setIsPlaying(false);
        notify(
          "Several tracks failed in a row — your network or a content blocker may be blocking playback.",
          "error",
          true
        );
      }
    },
  };

  /* ================================================================
     View model (local player, or the remote device's player)
     ================================================================ */

  const remotePosition = remoteState
    ? Math.min(
        remoteState.duration || Number.POSITIVE_INFINITY,
        remoteState.position +
          (remoteState.isPlaying ? remoteState.elapsed + (Date.now() - remoteState.receivedAt) / 1000 : 0)
      )
    : 0;

  const vm = remoteCode
    ? {
        track: remoteState?.track ?? null,
        isPlaying: !!remoteState?.isPlaying,
        position: remotePosition,
        duration: remoteState?.duration ?? 0,
        volume: remoteState?.volume ?? 0,
        muted: !!remoteState?.muted,
        buffering: false,
      }
    : { track: current, isPlaying, position, duration, volume, muted, buffering };

  const shownPosition = scrub ?? vm.position;
  const progressPct = vm.duration > 0 ? clamp((shownPosition / vm.duration) * 100, 0, 100) : 0;
  const shownVolume = vm.muted ? 0 : vm.volume;
  const upNext = remoteCode ? remoteState?.queue ?? [] : queue;
  const autoplayPreview = (() => {
    if (remoteCode || queue.length > 0 || !current) return [];
    const i = context.findIndex((x) => x.key === current.key);
    return i >= 0 ? context.slice(i + 1, i + 6) : [];
  })();
  const base = (linkBase || origin).replace(/\/+$/, "");
  const shareLink = hostCode && base ? `${base}/?connect=${hostCode}` : "";
  const usingPreviewBase = /e2b\.app|localhost|127\.0\.0\.1|ngrok|vercel\.app/i.test(base);
  const durationMax = Math.max(1, Math.floor(vm.duration));

  function commitScrub() {
    if (scrub !== null) {
      seekTo(scrub);
      setScrub(null);
    }
  }

  const tabMeta: Record<SideTab, { label: string; icon: ReactNode }> = {
    queue: { label: "Queue", icon: <I.IQueue size={15} /> },
    feed: { label: "Feed", icon: <I.IFeed size={15} /> },
    devices: { label: "Devices", icon: <I.IDevices size={15} /> },
  };

  /* ================================================================
     Render
     ================================================================ */

  return (
    <div className="app">
      {/* ─────────────── NAVBAR (glass) ─────────────── */}
      <header className="nav glass">
        <a href="/" className="brand" aria-label="Mehfil home">
          <span className="brand-word">MEHFIL</span>
          <span className="brand-sub">free · open-source · ad-free</span>
        </a>

        <div className="search-wrap" ref={searchWrapRef}>
          <div className="search">
            <I.ISearch size={17} className="search-icon" />
            <input
              ref={searchInputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && results[0]) playNow(results[0], results);
                if (e.key === "Escape") {
                  setSearchOpen(false);
                  e.currentTarget.blur();
                }
              }}
              placeholder="Search songs & artists, or paste a YouTube link"
              aria-label="Search YouTube"
              spellCheck={false}
              autoComplete="off"
            />
            {searching ? (
              <I.ISpinner size={16} className="spin search-state" />
            ) : query ? (
              <button
                type="button"
                className="search-clear"
                onClick={() => {
                  setQuery("");
                  searchInputRef.current?.focus();
                }}
                aria-label="Clear search"
              >
                <I.IClose size={15} />
              </button>
            ) : (
              <kbd className="kbd hide-m">/</kbd>
            )}
          </div>

          {searchOpen && query.trim().length >= 2 && (
            <div className="results glass" role="listbox" aria-label="Search results">
              {searching && results.length === 0 && <Skeleton rows={4} />}
              {results.map((t) => (
                <TrackRow
                  key={t.key}
                  t={t}
                  active={vm.track?.key === t.key}
                  playing={vm.isPlaying}
                  liked={likedKeys.has(t.key)}
                  onPlay={() => playNow(t, results)}
                  onNext={() => playNext(t)}
                  onQueue={() => enqueue(t)}
                  onLike={() => toggleLike(t)}
                />
              ))}
              {searchNote && <p className="note">{searchNote}</p>}
              {!searching && results.length > 0 && (
                <p className="results-foot">
                  Click to play · <I.IPlayNext size={12} /> next · <I.IQueueAdd size={12} /> queue ·{" "}
       <I.IHeart size={11} /> feed
                </p>
              )}
            </div>
          )}
        </div>

        <nav className="socials" aria-label="Connect with the developer">
          {SOCIAL_LINKS.map((l) => (
            <a
              key={l.id}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`icon-btn ${l.id}`}
              title={`${l.label} — connect with me`}
              aria-label={l.label}
            >
              <SocialIcon id={l.id} />
            </a>
          ))}
          <span className="nav-divider" aria-hidden />
          <button
            type="button"
            className="icon-btn help"
            onClick={() => setHelpOpen(true)}
            title="Help, FAQs & report a problem"
            aria-label="Help"
          >
            <I.IHelp size={18} />
          </button>
        </nav>
      </header>

      {/* ─────────────── MOBILE TABS ─────────────── */}
      <div className="mobile-tabs glass" role="tablist" aria-label="Sections">
        {(["discover", "queue", "feed", "devices"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={mobileTab === t}
            className={mobileTab === t ? "on" : ""}
            onClick={() => (t === "discover" ? setMobileTab("discover") : openSide(t))}
          >
            {t === "discover" ? <I.ICompass size={15} /> : tabMeta[t].icon}
            <span>{t === "discover" ? "Discover" : tabMeta[t].label}</span>
          </button>
        ))}
      </div>

      <main className="stage">
        {/* ─────────────── DISCOVER (glass) ─────────────── */}
        <section className={`panel glass discover${mobileTab !== "discover" ? " m-hide" : ""}`} aria-label="Discover">
          <div className="panel-head">
            <div className="min-w-0">
              <p className="eyebrow">
                <I.ICompass size={13} /> Discover
              </p>
              <h2 className="panel-title">{mood.label}</h2>
            </div>
          </div>

          <div className="chips">
            {DISCOVER_MOODS.map((m) => (
              <button
                key={m.label}
                type="button"
                className={`chip${m.label === mood.label ? " on" : ""}`}
                onClick={() => setMood(m)}
              >
                {m.label}
              </button>
            ))}
          </div>

          {discoverFallback && !discoverLoading && discover.length > 0 && (
            <p className="fallback-note">
              <I.IYouTube size={13} />
              No ad-free Audius matches for this mood — showing YouTube (YouTube may show its own ads).
            </p>
          )}

          <div className="panel-actions">
            <button
              type="button"
              className="btn-soft btn-lamp"
              disabled={discover.length === 0}
              onClick={() => discover[0] && playNow(discover[0], discover)}
            >
              <I.IPlay size={13} /> Play all
            </button>
            <button
              type="button"
              className="btn-soft"
              disabled={discover.length === 0}
              onClick={() => enqueueMany(discover)}
            >
              <I.IQueueAdd size={14} /> Queue all
            </button>
          </div>

          <div className="panel-scroll">
            {discoverLoading ? (
              <Skeleton rows={7} />
            ) : discoverError ? (
              <div className="empty">
                <p>{discoverError}</p>
                <button type="button" className="btn-soft" onClick={() => setDiscoverNonce((n) => n + 1)}>
                  Retry
                </button>
              </div>
            ) : (
              discover.map((t) => (
                <TrackRow
                  key={t.key}
                  t={t}
                  active={vm.track?.key === t.key}
                  playing={vm.isPlaying}
                  liked={likedKeys.has(t.key)}
                  onPlay={() => playNow(t, discover)}
                  onNext={() => playNext(t)}
                  onQueue={() => enqueue(t)}
                  onLike={() => toggleLike(t)}
                />
              ))
            )}
          </div>
        </section>

        {/* Center intentionally empty — the MEHFIL sign shows through */}
        <div className="stage-center" aria-hidden />

        <aside className="side">
          {/* ─────────────── NOW PLAYING (official players) ─────────────── */}
          <div className="now glass">
            <div className="media-frame">
              <div ref={ytHostRef} className={`engine${engine === "youtube" ? " on" : ""}`} />
              {/* Audius plays through a native audio element — ad-free, no iframe */}
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio ref={audioRef} preload="metadata" />
              {engine === "audius" && vm.track && (
                <div className="media-audius">
                  {vm.track.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={vm.track.thumbnail} alt="" referrerPolicy="no-referrer" />
                  ) : null}
                  <div className="media-audius-body">
                    <span className="media-audius-badge">
                      <I.IMusic size={15} /> Audius · ad-free
                    </span>
                    <p className="media-audius-title">{vm.track.title}</p>
                    <p className="media-audius-sub">{vm.track.artist}</p>
                    {isPlaying && (
                      <span className="media-audius-eq" aria-hidden>
                        <i />
                        <i />
                        <i />
                        <i />
                      </span>
                    )}
                  </div>
                </div>
              )}
              {!engine && !remoteCode && (
                <div className="media-empty">
                  <span className="media-logo">MEHFIL</span>
                  <p>Search anything or pick a mood — it plays right here.</p>
                </div>
              )}
              {remoteCode && (
                <div className="media-empty media-remote">
                  {remoteState?.track?.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={remoteState.track.thumbnail} alt="" referrerPolicy="no-referrer" />
                  ) : null}
                  <div className="media-remote-text">
                    <I.IDevices size={20} />
                    <p>Remote mode — the music plays on the other device</p>
                  </div>
                </div>
              )}
            </div>
            <div className="now-meta">
              <div className="min-w-0 flex-1">
                <p className="now-title">{vm.track?.title ?? "Nothing playing yet"}</p>
                <p className="now-sub">
                  {vm.track ? (
                    <>
                      <SourceBadge source={vm.track.source} />
                      <span className="truncate">{vm.track.artist}</span>
                    </>
                  ) : (
                    <span>No ads from us · no sign-up · open source</span>
                  )}
                </p>
              </div>
              {vm.track && (
                <a
                  className="act"
                  href={vm.track.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open on YouTube"
                  aria-label="Open the original"
                >
                  <I.IExternal size={15} />
                </a>
              )}
            </div>
          </div>

          {/* ─────────────── QUEUE / FEED / DEVICES (glass) ─────────────── */}
          <section
            className={`panel glass side-panel${mobileTab === "discover" ? " m-hide" : ""}`}
            aria-label="Queue, feed and devices"
          >
            <div className="tabs" role="tablist">
              {(["queue", "feed", "devices"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={sideTab === t}
                  className={`tab${sideTab === t ? " on" : ""}`}
                  onClick={() => openSide(t)}
                >
                  {tabMeta[t].icon}
                  {tabMeta[t].label}
                  {t === "queue" && upNext.length > 0 && <span className="count">{upNext.length}</span>}
                  {t === "devices" && (hostCode || remoteCode) && <span className="live-dot" />}
                </button>
              ))}
            </div>

            <div className="panel-scroll">
              {sideTab === "queue" && (
                <>
                  {vm.track && (
                    <>
                      <p className="section-label">Now playing{remoteCode ? " on the other device" : ""}</p>
                      <TrackRow
                        t={vm.track}
                        active
                        playing={vm.isPlaying}
                        liked={likedKeys.has(vm.track.key)}
                        onPlay={toggle}
                        onLike={() => vm.track && toggleLike(vm.track)}
                      />
                    </>
                  )}
                  <div className="section-head">
                    <p className="section-label">Up next · {upNext.length}</p>
                    {!remoteCode && queue.length > 0 && (
                      <button type="button" className="link-btn" onClick={() => setQueue([])}>
                        Clear
                      </button>
                    )}
                  </div>
                  {upNext.length === 0 ? (
                    <div className="empty">
                      <I.IQueue size={22} />
                      <p>
                        {remoteCode
                          ? "The other device has nothing queued."
                          : "Nothing queued yet. Use + on any track to line it up here."}
                      </p>
                    </div>
                  ) : (
                    upNext.map((t, i) => (
                      <TrackRow
                        key={`${t.key}-${i}`}
                        t={t}
                        liked={likedKeys.has(t.key)}
                        onPlay={() => playNow(t)}
                        onLike={() => toggleLike(t)}
                        onUp={!remoteCode && i > 0 ? () => move(i, -1) : undefined}
                        onDown={!remoteCode && i < upNext.length - 1 ? () => move(i, 1) : undefined}
                        onRemove={remoteCode ? undefined : () => removeAt(i)}
                      />
                    ))
                  )}
                  {autoplayPreview.length > 0 && (
                    <>
                      <p className="section-label">Autoplay continues with</p>
                      <div className="dim">
                        {autoplayPreview.map((t) => (
                          <TrackRow
                            key={`auto-${t.key}`}
                            t={t}
                            onPlay={() => playNow(t, context)}
                            onQueue={() => enqueue(t)}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}

              {sideTab === "feed" && (
                <>
                  <div className="section-head">
                    <p className="section-label">
                      <I.IHeart size={12} filled /> Liked · {liked.length}
                    </p>
                    {liked.length > 0 && (
                      <button type="button" className="link-btn" onClick={() => playNow(liked[0], liked)}>
                        Play all
                      </button>
                    )}
                  </div>
                  {liked.length === 0 ? (
                    <div className="empty">
                      <p>Tap ♥ on any track to keep it in your feed.</p>
                    </div>
                  ) : (
                    liked.map((t) => (
                      <TrackRow
                        key={`liked-${t.key}`}
                        t={t}
                        active={vm.track?.key === t.key}
                        playing={vm.isPlaying}
                        liked
                        onPlay={() => playNow(t, liked)}
                        onNext={() => playNext(t)}
                        onQueue={() => enqueue(t)}
                        onLike={() => toggleLike(t)}
                      />
                    ))
                  )}

                  <div className="section-head">
                    <p className="section-label">Recently played</p>
                    {feed.length > 0 && (
                      <button type="button" className="link-btn" onClick={() => setFeed([])}>
                        Clear
                      </button>
                    )}
                  </div>
                  {feed.length === 0 ? (
                    <div className="empty">
                      <p>Your listening history shows up here.</p>
                    </div>
                  ) : (
                    feed.map((t) => (
                      <TrackRow
                        key={`feed-${t.key}`}
                        t={t}
                        active={vm.track?.key === t.key}
                        playing={vm.isPlaying}
                        liked={likedKeys.has(t.key)}
                        onPlay={() => playNow(t, feed)}
                        onNext={() => playNext(t)}
                        onQueue={() => enqueue(t)}
                        onLike={() => toggleLike(t)}
                      />
                    ))
                  )}
                </>
              )}

              {sideTab === "devices" && (
                <div className="devices">
                  <div className="device-card">
                    <span className="device-icon">
                      <I.IDevices size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="device-name">{device}</p>
                      <p className="device-sub">
                        {remoteCode
                          ? `Remote control for session ${remoteCode}`
                          : hostCode
                            ? "Playing here · hosting a session"
                            : "Playing on this device"}
                      </p>
                    </div>
                    <span className={`dot${hostCode || remoteCode ? " live" : ""}`} aria-hidden />
                  </div>

                  {!remoteCode && (
                    <div className="device-block">
                      <p className="section-label">Connect another device</p>
                      {hostCode ? (
                        <div className="host-box">
                          <p className="device-sub">
                            Scan with your phone, or open the link on any device — it becomes a remote for this
                            player. Keep this tab open.
                          </p>
                          {usingPreviewBase && (
                            <p className="warn">
                              The link below points to a <strong>preview URL</strong> (this sandbox/local
                              address), so a scanned QR code opens the preview instead of your live site.
                              Set your real website address to generate a link that works on your phone.
                            </p>
                          )}

                          <div className="base-row">
                            {editingBase ? (
                              <>
                                <input
                                  autoFocus
                                  value={linkBase}
                                  onChange={(e) => setLinkBase(e.target.value)}
                                  onBlur={() => setEditingBase(false)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") setEditingBase(false);
                                    if (e.key === "Escape") setEditingBase(false);
                                  }}
                                  placeholder="https://your-site.vercel.app"
                                  aria-label="Public site address"
                                  spellCheck={false}
                                />
                                <button
                                  type="button"
                                  className="act"
                                  onClick={() => setEditingBase(false)}
                                  aria-label="Save address"
                                  title="Save"
                                >
                                  ✓
                                </button>
                              </>
                            ) : (
                              <>
                                <span className="base-value" title="Address used for the share link">
                                  {base || "—"}
                                </span>
                                <button
                                  type="button"
                                  className="act"
                                  onClick={() => setEditingBase(true)}
                                  aria-label="Change the public site address"
                                  title="Change address"
                                >
                                  <I.IExternal size={14} />
                                </button>
                              </>
                            )}
                          </div>

                          <div className="host-row">
                            {shareLink && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                className="qr"
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=${encodeURIComponent(shareLink)}`}
                                alt={`QR code to join session ${hostCode}`}
                                width={112}
                                height={112}
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="code">{hostCode}</p>
                              <div className="link-row">
                                <input
                                  readOnly
                                  value={shareLink}
                                  onFocus={(e) => e.currentTarget.select()}
                                  aria-label="Session link"
                                />
                                <button
                                  type="button"
                                  className="act"
                                  onClick={() => copyText(shareLink)}
                                  aria-label="Copy link"
                                  title="Copy link"
                                >
                                  <I.ICopy size={15} />
                                </button>
                              </div>
                            </div>
                          </div>
                          <button type="button" className="btn-soft" onClick={endSession}>
                            End session
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="btn-soft btn-lamp btn-block"
                          onClick={startSession}
                          disabled={connecting}
                        >
                          <I.IDevices size={15} /> {connecting ? "Starting…" : "Start a session"}
                        </button>
                      )}
                    </div>
                  )}

                  {!hostCode && (
                    <div className="device-block">
                      <p className="section-label">{remoteCode ? "Connected" : "Control another device"}</p>
                      {remoteCode ? (
                        <div className="host-box">
                          <p className="device-sub">
                            {remoteState?.track
                              ? `Now on that device: ${remoteState.track.title}`
                              : "Waiting for the other device to share its player…"}
                          </p>
                          <button type="button" className="btn-soft" onClick={leaveRemote}>
                            Disconnect
                          </button>
                        </div>
                      ) : (
                        <form
                          className="join-row"
                          onSubmit={(e) => {
                            e.preventDefault();
                            void joinSession(joinInput);
                          }}
                        >
                          <input
                            value={joinInput}
                            onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                            placeholder="6-character code"
                            maxLength={6}
                            aria-label="Session code"
                            autoComplete="off"
                            spellCheck={false}
                          />
                          <button
                            type="submit"
                            className="btn-soft"
                            disabled={connecting || joinInput.trim().length < 6}
                          >
                            Connect
                          </button>
                        </form>
                      )}
                    </div>
                  )}

                  {persistentSync === false && (
                    <p className="note">
                      Device sync is running in memory (no database configured), so it works best when both
                      devices reach the same server. Add a <code>DATABASE_URL</code> for rock-solid syncing.
                    </p>
                  )}

                  <div className="device-block">
                    <p className="section-label">Speakers, headphones &amp; TV</p>
                    <ul className="tips">
                      <li>
                        Bluetooth headphones, speakers &amp; car audio — pair them with your device as usual and
                        Mehfil plays through them.
                      </li>
                      <li>
                        TV or smart speaker — use your browser&apos;s <strong>Cast</strong> (Chrome/Edge) or{" "}
                        <strong>AirPlay</strong> (Safari) to send this tab.
                      </li>
                      <li>
                        Keyboard — <kbd>Space</kbd> play/pause · <kbd>Shift</kbd>+<kbd>←</kbd>/<kbd>→</kbd>{" "}
                        prev/next · <kbd>M</kbd> mute · <kbd>/</kbd> search
                      </li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </section>
        </aside>
      </main>

      {/* ─────────────── PLAYER BAR (glass, always on) ─────────────── */}
      {/* ════════════════════════════════════════════════
          ADD A PLAYLIST
          ════════════════════════════════════════════════ */}
      {addOpen && (
        <div className="modal-backdrop" onClick={() => setAddOpen(false)} role="presentation">
          <div
            className="modal glass"
            role="dialog"
            aria-modal="true"
            aria-label="Add a playlist"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <p className="eyebrow">Your library</p>
                <h2 className="panel-title">Add a playlist</h2>
              </div>
              <button type="button" className="act" onClick={() => setAddOpen(false)} aria-label="Close">
                <I.IClose size={18} />
              </button>
            </div>

            <p className="modal-hint">
              Paste a <strong>YouTube playlist</strong> link (it contains <code>list=…</code>). It becomes a new
              section in your archive and starts playing right away.
            </p>

            <form
              className="join-row"
              onSubmit={(e) => {
                e.preventDefault();
                void importPlaylist();
              }}
            >
              <input
                autoFocus
                value={playlistUrl}
                onChange={(e) => setPlaylistUrl(e.target.value)}
                placeholder="https://www.youtube.com/playlist?list=PL…"
                aria-label="Playlist link"
                spellCheck={false}
              />
              <button type="submit" className="btn-soft btn-lamp" disabled={playlistLoading}>
                {playlistLoading ? "Importing…" : "Import"}
              </button>
            </form>

            {playlistError && <p className="modal-error">{playlistError}</p>}

            {imported.length > 0 && (
              <>
                <p className="section-label">Imported playlists</p>
                {imported.map((pl) => (
                  <div key={pl.label} className="imported-row">
                    <div className="min-w-0 flex-1">
                      <p className="imported-label">{pl.label}</p>
                      <p className="device-sub">{pl.tracks.length} tracks</p>
                    </div>
                    <button
                      type="button"
                      className="btn-soft"
                      onClick={() => playNow(pl.tracks[0], pl.tracks)}
                    >
                      <I.IPlay size={13} /> Play
                    </button>
                    <button
                      type="button"
                      className="btn-soft"
                      onClick={() => enqueueMany(pl.tracks)}
                    >
                      <I.IQueueAdd size={14} /> Queue
                    </button>
                    <button
                      type="button"
                      className="act"
                      onClick={() => removeImported(pl.label)}
                      aria-label="Remove playlist"
                      title="Remove"
                    >
                      <I.IClose size={15} />
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      <footer className="player glass" aria-label="Player controls">
        <div className="player-left">
          <div className="player-art">
            {vm.track?.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={vm.track.thumbnail} alt="" referrerPolicy="no-referrer" />
            ) : (
              <I.IMusic size={20} />
            )}
          </div>
          <div className="player-meta">
            <p className="player-title">{vm.track?.title ?? "Nothing playing"}</p>
            <p className="player-artist">
              {vm.track ? (
                <>
                  <SourceBadge source={vm.track.source} />
                  <span className="truncate">{vm.track.artist}</span>
                </>
              ) : remoteCode ? (
                "Waiting for the other device…"
              ) : (
                "Search or pick a mood to start"
              )}
            </p>
          </div>
          {vm.track && (
            <button
              type="button"
              className={`act hide-xs${likedKeys.has(vm.track.key) ? " on" : ""}`}
              onClick={() => vm.track && toggleLike(vm.track)}
              aria-label="Like"
              title="Save to your feed"
            >
              <I.IHeart size={16} filled={likedKeys.has(vm.track.key)} />
            </button>
          )}
        </div>

        <div className="player-center">
          <div className="player-controls">
            <button
              type="button"
              className={`ctrl hide-m${shuffle ? " on" : ""}`}
              onClick={() => setShuffle((s) => !s)}
              disabled={!!remoteCode}
              aria-pressed={shuffle}
              aria-label="Shuffle"
              title="Shuffle"
            >
              <I.IShuffle size={17} />
            </button>
            <button type="button" className="ctrl" onClick={prev} aria-label="Previous" title="Previous (Shift+←)">
              <I.IPrev size={19} />
            </button>
            <button
              type="button"
              className="ctrl ctrl-main"
              onClick={toggle}
              aria-label={vm.isPlaying ? "Pause" : "Play"}
              title="Play / Pause (Space)"
            >
              {vm.buffering && !vm.isPlaying ? (
                <I.ISpinner size={20} className="spin" />
              ) : vm.isPlaying ? (
                <I.IPause size={20} />
              ) : (
                <I.IPlay size={20} />
              )}
            </button>
            <button type="button" className="ctrl" onClick={() => next()} aria-label="Next" title="Next (Shift+→)">
              <I.INext size={19} />
            </button>
            <button
              type="button"
              className={`ctrl hide-m${repeat !== "off" ? " on" : ""}`}
              onClick={() => setRepeat((r) => (r === "off" ? "all" : r === "all" ? "one" : "off"))}
              disabled={!!remoteCode}
              aria-label={`Repeat: ${repeat}`}
              title={`Repeat: ${repeat}`}
            >
              {repeat === "one" ? <I.IRepeatOne size={17} /> : <I.IRepeat size={17} />}
            </button>
          </div>
          <div className="player-timeline">
            <span>{fmt(shownPosition)}</span>
            <input
              type="range"
              className="range"
              min={0}
              max={durationMax}
              step={1}
              value={Math.min(Math.floor(shownPosition), durationMax)}
              disabled={!vm.track || vm.duration <= 0}
              onChange={(e) => setScrub(Number(e.target.value))}
              onPointerUp={commitScrub}
              onKeyUp={commitScrub}
              onBlur={commitScrub}
              style={{ "--pct": `${progressPct}%` } as CSSProperties}
              aria-label="Seek"
            />
            <span>{fmt(vm.duration)}</span>
          </div>
        </div>

        <div className="player-right">
          {remoteCode ? (
            <span className="pill">Remote · {remoteCode}</span>
          ) : hostCode ? (
            <span className="pill">Hosting · {hostCode}</span>
          ) : null}
          <button
            type="button"
            className={`ctrl${addOpen ? " on" : ""}`}
            onClick={() => {
              setAddOpen(true);
              setPlaylistError(null);
            }}
            aria-label="Add a playlist"
            title="Add a playlist"
          >
            <I.IQueueAdd size={18} />
          </button>
          <button
            type="button"
            className={`ctrl${sideTab === "queue" ? " on" : ""}`}
            onClick={() => openSide("queue")}
            aria-label="Queue"
            title="Queue"
          >
            <I.IQueue size={18} />
          </button>
          <button
            type="button"
            className={`ctrl${hostCode || remoteCode ? " on" : ""}`}
            onClick={() => openSide("devices")}
            aria-label="Connect a device"
            title="Connect a device"
          >
            <I.IDevices size={18} />
          </button>
          <button
            type="button"
            className="ctrl"
            onClick={toggleMute}
            aria-label={shownVolume === 0 ? "Unmute" : "Mute"}
            title="Mute (M)"
          >
            {shownVolume === 0 ? <I.IMute size={18} /> : <I.IVolume size={18} />}
          </button>
          <input
            type="range"
            className="range volume"
            min={0}
            max={100}
            step={1}
            value={shownVolume}
            onChange={(e) => changeVolume(Number(e.target.value))}
            style={{ "--pct": `${shownVolume}%` } as CSSProperties}
            aria-label="Volume"
          />
        </div>
      </footer>

      {/* ─────────────── TOASTS ─────────────── */}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast glass ${t.kind}`}>
            <span>{t.text}</span>
            {t.report && (
              <a href={SITE.issues} target="_blank" rel="noopener noreferrer">
                Report
              </a>
            )}
            <button
              type="button"
              className="act"
              onClick={() => setToasts((list) => list.filter((x) => x.id !== t.id))}
              aria-label="Dismiss"
            >
              <I.IClose size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* ─────────────── HELP / CONTACT ─────────────── */}
      {helpOpen && (
        <div className="modal-backdrop" onClick={() => setHelpOpen(false)} role="presentation">
          <div
            className="modal glass"
            role="dialog"
            aria-modal="true"
            aria-label="Help and contact"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <p className="eyebrow">Help &amp; contact</p>
                <h2 className="panel-title">Questions or problems?</h2>
              </div>
              <button type="button" className="act" onClick={() => setHelpOpen(false)} aria-label="Close">
                <I.IClose size={18} />
              </button>
            </div>

            <div className="faq">
              <details open>
                <summary>Nothing plays when I click a track</summary>
                <p>
                  Browsers only allow sound after you interact with the page, so press ▶ once. If it stays silent,
                  allow youtube.com in your ad/content blocker and reload.
                </p>
              </details>
              <details>
                <summary>A track was skipped automatically</summary>
                <p>
                  Some uploaders block their videos from playing on other websites, or the track was removed.
                  Mehfil skips those instead of getting stuck.
                </p>
              </details>
              <details>
                <summary>Is it really free and ad-free?</summary>
                <p>
                  Mehfil itself has no ads, trackers or accounts, and the code is MIT-licensed open source. Music
                  streams through the official YouTube player — YouTube may still show its own ads
                  on some videos. We don&apos;t strip those, because that would break YouTube&apos;s terms.
                </p>
              </details>
              <details>
                <summary>How do I connect my phone or another device?</summary>
                <p>
                  Open <strong>Devices</strong> → <strong>Start a session</strong>, then scan the QR code with your
                  phone (or type the 6-character code). That device becomes a remote: play, pause, skip, seek, and
                  queue — while the music keeps playing here.
                </p>
              </details>
              <details>
                <summary>Where is my data stored?</summary>
                <p>
                  Your queue, likes and history stay in this browser (localStorage). A device session only stores
                  the current track and queue, and expires after a few hours.
                </p>
              </details>
            </div>

            <p className="section-label">Reach me directly</p>
            <div className="contact-grid">
              {SOCIAL_LINKS.map((l) => (
                <a
                  key={l.id}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`contact ${l.id}`}
                >
                  <SocialIcon id={l.id} /> {l.label}
                </a>
              ))}
            </div>
            <a className="btn-soft btn-lamp btn-block" href={SITE.issues} target="_blank" rel="noopener noreferrer">
              <I.IGitHub size={15} /> Report a bug or request a feature
            </a>
            <p className="fine">
              Mehfil is open source —{" "}
              <a href={SITE.repo} target="_blank" rel="noopener noreferrer">
                view the code on GitHub
              </a>
              .
            </p>
          </div>
        </div>
      )}
    </div>
  );
}