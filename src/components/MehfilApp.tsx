"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FALLBACK_SECTIONS,
  SEGMENT_LABELS,
  STORAGE_FAVS,
  STORAGE_TITLES,
  formatIndex,
  thumbUrl,
  youtubeWatchUrl,
} from "@/lib/mehfil";

/* ================================================================
   Types
   ================================================================ */

interface Track {
  index: number;
  id: string;
  title: string;
  artist: string;
  rawTitle: string;
  thumbnail: string;
  duration: string;
  source: number;
}

interface Section {
  label: string;
  count: number;
}

/* ================================================================
   Helpers
   ================================================================ */

const YT_ORIGINS = new Set([
  "https://www.youtube.com",
  "https://www.youtube-nocookie.com",
]);

function formatTime(sec: number): string {
  if (!sec || !isFinite(sec) || isNaN(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function parseTitle(raw: string): { title: string; artist: string } {
  const cleaned = raw
    .replace(/\s*[\(\[]?(Official|Lyric|Full|HD|4K|Video|Audio|Live).*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  const parts = cleaned.split(/\s[-–—|]\s/);
  if (parts.length >= 2) {
    return {
      title: parts[0].trim(),
      artist: parts.slice(1).join(" — ").trim(),
    };
  }
  return { title: cleaned || raw, artist: "" };
}

function embedUrl(id: string, autoplay: boolean): string {
  return `https://www.youtube.com/embed/${id}?enablejsapi=1&autoplay=${
    autoplay ? 1 : 0
  }&rel=0&modestbranding=1&playsinline=1`;
}

/* ================================================================
   Icons
   ================================================================ */

function IconPlay({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function IconPause({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  );
}

function IconPrev({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
    </svg>
  );
}

function IconNext({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function IconHeart({ filled }: { filled: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function IconVolume() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
    </svg>
  );
}

function IconMute() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.9 8.9 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z" />
    </svg>
  );
}

function IconExternal() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 3h7v7" />
      <path d="M10 14 21 3" />
      <path d="M21 14v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h6" />
    </svg>
  );
}

/* ================================================================
   Main App
   ================================================================ */

export default function MehfilApp() {
  const [view, setView] = useState<"landing" | "archive">("landing");

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [boundaries, setBoundaries] = useState<number[]>([0]);
  const [loadingList, setLoadingList] = useState(true);
  const [titlesLoading, setTitlesLoading] = useState(false);
  const [duplicatesRemoved, setDuplicatesRemoved] = useState(0);

  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [trackTitles, setTrackTitles] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [showFavorites, setShowFavorites] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const currentIndexRef = useRef(0);
  const tracksRef = useRef<Track[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const skipGuardRef = useRef(0);
  const trackItemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const archiveRef = useRef<HTMLElement | null>(null);
  const pendingAutoplayRef = useRef(false);

  currentIndexRef.current = currentIndex;
  tracksRef.current = tracks;

  /* ── Derived ───────────────────────────────────────── */

  const current = tracks[currentIndex];
  const currentId = current?.id ?? "";
  const displayTitle = current?.title ?? "Preparing the mehfil…";
  const displayArtist =
    current?.artist || "The Sufi Listening Room";

  const filteredTracks = useMemo(() => {
    let list = tracks;
    if (showFavorites) list = list.filter((t) => favorites.has(t.index ?? -1));
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.rawTitle.toLowerCase().includes(q)
      );
    }
    return list;
  }, [tracks, favorites, showFavorites, searchQuery]);

  /* ── Persistence ────────────────────────────────────── */

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_FAVS);
      if (raw) setFavorites(new Set(JSON.parse(raw)));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_FAVS, JSON.stringify([...favorites]));
    } catch {
      /* ignore */
    }
  }, [favorites]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_TITLES);
      if (raw) setTrackTitles(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (Object.keys(trackTitles).length > 0) {
      try {
        localStorage.setItem(STORAGE_TITLES, JSON.stringify(trackTitles));
      } catch {
        /* ignore */
      }
    }
  }, [trackTitles]);

  /* ── Load the full queue from the server ────────────── */

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/playlist");
        const data: {
          items?: Array<{
            id: string;
            title: string;
            channel: string;
            duration: string;
            thumbnail: string;
            segmentIndex: number;
            segmentLabel: string;
          }>;
          sections?: Section[];
          removedDuplicates?: number;
        } = await res.json();

        if (cancelled) return;

        let items = data.items ?? [];
        if (items.length === 0) {
          // Absolute last resort: baked-in snapshot
          items = FALLBACK_SECTIONS.flatMap((s, i) =>
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
        }

        const starts: number[] = [];
        const seenSeg = new Set<number>();
        const mapped: Track[] = items.map((it, i) => {
          if (!seenSeg.has(it.segmentIndex)) {
            seenSeg.add(it.segmentIndex);
            starts.push(i);
          }
          return {
            index: i,
            id: it.id,
            title: it.title,
            artist: it.channel,
            rawTitle: it.title,
            thumbnail: it.thumbnail,
            duration: it.duration,
            source: it.segmentIndex,
          };
        });

        setTracks(mapped);
        setSections(
          (data.sections ?? SEGMENT_LABELS.map((label, i) => ({
            label,
            count: mapped.filter((m) => m.source === i).length,
          })))
        );
        setBoundaries(starts);
        setDuplicatesRemoved(data.removedDuplicates ?? 0);
      } catch {
        if (cancelled) return;
        // Network/scraper fully down — use the baked snapshot
        const items = FALLBACK_SECTIONS.flatMap((s, i) =>
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
        const starts: number[] = [];
        const seenSeg = new Set<number>();
        const mapped: Track[] = items.map((it, i) => {
          if (!seenSeg.has(it.segmentIndex)) {
            seenSeg.add(it.segmentIndex);
            starts.push(i);
          }
          return {
            index: i,
            id: it.id,
            title: it.title,
            artist: it.channel,
            rawTitle: it.title,
            thumbnail: it.thumbnail,
            duration: it.duration,
            source: it.segmentIndex,
          };
        });
        setTracks(mapped);
        setSections(
          SEGMENT_LABELS.map((label, i) => ({
            label,
            count: mapped.filter((m) => m.source === i).length,
          }))
        );
        setBoundaries(starts);
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /* ── Resolve missing titles via oEmbed ──────────────── */

  useEffect(() => {
    if (tracks.length === 0) return;
    const missing = tracks.filter((t) => !t.title && !trackTitles[t.id]);
    if (missing.length === 0) return;

    let cancelled = false;
    setTitlesLoading(true);

    fetch("/api/playlist-titles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoIds: missing.map((m) => m.id) }),
    })
      .then(async (res) => {
        if (!res.ok) return;
        const data: { titles?: Record<string, string> } = await res.json();
        if (!data.titles) return;
        if (cancelled) return;
        setTrackTitles((prev) => ({ ...prev, ...data.titles }));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setTitlesLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks.length]);

  /* ── Apply oEmbed titles to the display list ────────── */

  const displayTracks = useMemo(() => {
    return tracks.map((t) => {
      const raw = trackTitles[t.id] || t.rawTitle || "";
      if (!raw || raw === t.rawTitle) return t;
      const parsed = parseTitle(raw);
      return {
        ...t,
        title: parsed.title,
        artist: parsed.artist || t.artist,
        rawTitle: raw,
      };
    });
  }, [tracks, trackTitles]);

  /* ── postMessage bridge to the YouTube embed ────────── */

  const sendCmd = useCallback((func: string, args: unknown[] = []) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    try {
      win.postMessage(
        JSON.stringify({ event: "command", func, args }),
        "https://www.youtube.com"
      );
    } catch {
      /* ignore */
    }
  }, []);

  const startPolling = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      sendCmd("getCurrentTime");
      sendCmd("getDuration");
    }, 1000);
  }, [sendCmd]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  /* ── Track switching (iframe remount = new video) ───── */

  const playAt = useCallback((idx: number) => {
    const list = tracksRef.current;
    if (list.length === 0) return;
    const clamped = ((idx % list.length) + list.length) % list.length;
    skipGuardRef.current = 0;
    setCurrentTime(0);
    setDuration(0);
    setCurrentIndex(clamped);
    if (clamped === currentIndexRef.current) {
      sendCmd("playVideo");
    }
    // A changed index remounts the iframe with autoplay=1
    setIsPlaying(true);
  }, [sendCmd]);

  const advance = useCallback(() => {
    const list = tracksRef.current;
    if (list.length === 0) return;
    if (currentIndexRef.current >= list.length - 1) {
      setIsPlaying(false);
      stopPolling();
      return;
    }
    playAt(currentIndexRef.current + 1);
  }, [playAt, stopPolling]);

  /* ── Listen for player state messages ───────────────── */

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (!YT_ORIGINS.has(e.origin)) return;
      if (typeof e.data !== "string") return;
      let data: { event?: string; info?: number | string };
      try {
        data = JSON.parse(e.data);
      } catch {
        return;
      }
      switch (data.event) {
        case "onReady":
          setIsReady(true);
          sendCmd("getDuration");
          break;
        case "onStateChange": {
          const s = Number(data.info);
          if (s === 1) {
            // playing
            skipGuardRef.current = 0;
            setIsPlaying(true);
            startPolling();
          } else if (s === 2) {
            // paused
            setIsPlaying(false);
            stopPolling();
          } else if (s === 0) {
            // ended → next piece
            setIsPlaying(false);
            stopPolling();
            advance();
          }
          break;
        }
        case "onCurrentTime":
          setCurrentTime(Number(data.info) || 0);
          break;
        case "onDurationChange":
          setDuration(Number(data.info) || 0);
          break;
        case "onError": {
          const code = Number(data.info);
          // 2 invalid param, 5 html5, 100 not found, 101/150 embed blocked
          if (code === 101 || code === 150 || code === 100) {
            skipGuardRef.current += 1;
            if (skipGuardRef.current > 6) {
              setIsPlaying(false);
              stopPolling();
              break;
            }
            advance();
          }
          break;
        }
      }
    };
    window.addEventListener("message", onMsg);
    return () => {
      window.removeEventListener("message", onMsg);
      stopPolling();
    };
  }, [sendCmd, startPolling, stopPolling, advance]);

  /* ── Scroll active track ────────────────────────────── */

  useEffect(() => {
    if (view !== "archive") return;
    const el = trackItemRefs.current.get(currentIndex);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [currentIndex, view]);

  /* ── Controls ──────────────────────────────────────── */

  const play = useCallback(() => {
    if (!currentId) return;
    sendCmd("playVideo");
    setIsPlaying(true);
  }, [currentId, sendCmd]);

  const pause = useCallback(() => {
    sendCmd("pauseVideo");
    setIsPlaying(false);
  }, [sendCmd]);

  const togglePlay = useCallback(() => {
    if (isPlaying) pause();
    else play();
  }, [isPlaying, play, pause]);

  const next = useCallback(() => {
    if (tracks.length === 0) return;
    playAt(currentIndexRef.current + 1);
  }, [tracks.length, playAt]);

  const prev = useCallback(() => {
    if (tracks.length === 0) return;
    playAt(currentIndexRef.current - 1);
  }, [tracks.length, playAt]);

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!duration) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / rect.width)
      );
      const t = pct * duration;
      sendCmd("seekTo", [t, true]);
      setCurrentTime(t);
    },
    [duration, sendCmd]
  );

  const handleVolume = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / rect.width)
      );
      const vol = Math.round(pct * 100);
      sendCmd("setVolume", [vol]);
      setVolume(vol);
      if (vol > 0 && isMuted) {
        sendCmd("unMute");
        setIsMuted(false);
      }
    },
    [isMuted, sendCmd]
  );

  const toggleMute = useCallback(() => {
    if (isMuted) {
      sendCmd("unMute");
      setIsMuted(false);
    } else {
      sendCmd("mute");
      setIsMuted(true);
    }
  }, [isMuted, sendCmd]);

  const toggleFavorite = useCallback((idx: number) => {
    setFavorites((prev) => {
      const nextSet = new Set(prev);
      if (nextSet.has(idx)) nextSet.delete(idx);
      else nextSet.add(idx);
      return nextSet;
    });
  }, []);

  const enterArchive = useCallback(
    (startPlaying = false) => {
      setView("archive");
      requestAnimationFrame(() => {
        archiveRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
      if (startPlaying) play();
    },
    [play]
  );

  /* ── Keyboard ──────────────────────────────────────── */

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      switch (e.key) {
        case " ":
          e.preventDefault();
          if (view === "landing") enterArchive(true);
          else togglePlay();
          break;
        case "ArrowRight":
          next();
          break;
        case "ArrowLeft":
          prev();
          break;
        case "m":
        case "M":
          toggleMute();
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [view, enterArchive, togglePlay, next, prev, toggleMute]);

  /* ================================================================
     RENDER
     ================================================================ */

  const sectionLabels =
    sections.length > 0 ? sections.map((s) => s.label) : SEGMENT_LABELS;

  return (
    <div className={`mehfil-stage ${isReady ? "has-player-bar" : ""}`}>
      {/* ════════════════════════════════════════════════
          LANDING
          ════════════════════════════════════════════════ */}
      {view === "landing" && (
        <section className="relative min-h-screen flex flex-col">
          <div className="flex-1 max-w-7xl mx-auto w-full px-6 sm:px-10 lg:px-14 py-10 sm:py-14 lg:py-16">
            <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-12 lg:gap-16 xl:gap-20 items-center min-h-[70vh]">
              <div className="fade-up">
                <p className="eyebrow flex items-center gap-2 mb-7">
                  <span aria-hidden>✦</span>
                  The Sufi Listening Room
                </p>

                <h1 className="headline text-[clamp(2.8rem,8vw,5.6rem)] max-w-xl">
                  Not just music.
                  <br />
                  <em className="gold">A Mehfil.</em>
                </h1>

                <p className="mt-7 max-w-lg text-[1.02rem] leading-relaxed text-[color:var(--color-cream-dim)]">
                  A quiet digital room for qawwali — for late nights, old
                  memories, long drives, prayer, poetry, and the moments when a
                  voice says what you cannot.
                </p>

                <div className="mt-9 flex flex-wrap gap-3">
                  <button
                    className="btn btn-gold"
                    onClick={() => enterArchive(true)}
                  >
                    <IconPlay size={15} />
                    Enter the Mehfil
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => enterArchive(false)}
                  >
                    Listen to the classics
                  </button>
                </div>

                <p className="mt-8 text-sm italic text-[color:var(--color-muted)] font-serif">
                  For the ones who listen with their whole heart.
                </p>
              </div>

              <div
                className="fade-up flex justify-center lg:justify-end"
                style={{ animationDelay: "0.12s" }}
              >
                <div className="portrait-frame w-full max-w-[380px] aspect-[3/4]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/nusrat-portrait.jpg"
                    alt="Ustad Nusrat Fateh Ali Khan"
                  />
                  <div className="portrait-caption">
                    <p className="text-[0.65rem] tracking-[0.28em] uppercase text-[color:var(--color-gold)] mb-1.5">
                      Ustad
                    </p>
                    <p className="font-serif text-[1.85rem] leading-[1.05] text-[color:var(--color-cream)]">
                      Nusrat
                      <br />
                      Fateh Ali Khan
                    </p>
                    <p className="mt-2 text-[0.65rem] tracking-[0.22em] uppercase text-[color:var(--color-muted)]">
                      The Voice of Qawwali
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-[color:var(--color-line)]">
            <div className="max-w-7xl mx-auto grid sm:grid-cols-3">
              {[
                { n: "01", t: "Listen without rushing." },
                { n: "02", t: "Let the poetry stay." },
                { n: "03", t: "Come back whenever you need it." },
              ].map((item, i) => (
                <div
                  key={item.n}
                  className={`px-6 sm:px-10 py-6 sm:py-7 flex items-baseline gap-4 ${
                    i < 2
                      ? "sm:border-r border-[color:var(--color-line)]"
                      : ""
                  } border-b sm:border-b-0 border-[color:var(--color-line)]`}
                >
                  <span className="text-[0.7rem] tracking-[0.18em] text-[color:var(--color-gold)]">
                    {item.n}
                  </span>
                  <span className="font-serif italic text-[1.05rem] text-[color:var(--color-cream-dim)]">
                    {item.t}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════════
          ARCHIVE (always mounted — holds the live player)
          ════════════════════════════════════════════════ */}
      <section
        ref={archiveRef}
        className={
          view === "archive"
            ? "min-h-screen flex flex-col"
            : "min-h-screen flex flex-col archive-hidden"
        }
      >
        <header className="sticky top-0 z-40 border-b border-[color:var(--color-line)] bg-[rgba(7,6,5,0.72)] backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 h-14 flex items-center justify-between gap-4">
            <button
              onClick={() => setView("landing")}
              className="eyebrow hover:text-[color:var(--color-gold-soft)] transition-colors"
            >
              ← The Archive
            </button>

            <div className="flex items-center gap-3 sm:gap-4">
              <button
                onClick={() => setShowFavorites((v) => !v)}
                className={`p-2 rounded-full transition-colors ${
                  showFavorites
                    ? "text-[color:var(--color-gold)]"
                    : "text-[color:var(--color-muted)] hover:text-[color:var(--color-gold)]"
                }`}
                aria-label="Favorites"
              >
                <IconHeart filled={showFavorites} />
              </button>
              <div className="hidden sm:flex items-center gap-2 border-b border-[color:var(--color-line)] pb-1 min-w-[200px]">
                <IconSearch />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search the mehfil…"
                  className="bg-transparent border-0 outline-none text-sm w-full placeholder:text-[color:var(--color-muted-dim)]"
                />
              </div>
            </div>
          </div>
          </header>

          <main className="flex-1 max-w-7xl mx-auto w-full px-5 sm:px-8 py-10 sm:py-12">
            <div className="mb-8 sm:mb-10 max-w-2xl">
              <p className="eyebrow mb-3">The Archive</p>
              <h2 className="headline text-[clamp(2.2rem,5vw,3.6rem)]">
                Qawwali, <em className="gold">kept close.</em>
              </h2>
              <p className="mt-4 text-[color:var(--color-cream-dim)] leading-relaxed">
                A hand-curated listening shelf. Every playable entry opens
                through the official YouTube embed.
              </p>
            </div>

            <div className="sm:hidden mb-6 flex items-center gap-2 border-b border-[color:var(--color-line)] pb-2">
              <IconSearch />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search the mehfil…"
                className="bg-transparent border-0 outline-none text-sm w-full placeholder:text-[color:var(--color-muted-dim)]"
              />
            </div>

            <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-6 lg:gap-8 items-start">
              {/* Track list */}
              <div className="glass overflow-hidden">
                <div className="max-h-[min(70vh,760px)] overflow-y-auto">
                  {loadingList && (
                    <div className="py-20 text-center text-[color:var(--color-muted)]">
                      <div className="w-8 h-8 border border-[color:var(--color-gold)] border-t-transparent rounded-full spin mx-auto mb-4" />
                      <p className="text-sm">Opening the archive…</p>
                    </div>
                  )}

                  {!loadingList && filteredTracks.length === 0 && (
                    <div className="py-20 text-center text-[color:var(--color-muted)]">
                      {showFavorites ? (
                        <>
                          <p className="font-serif italic text-xl mb-2">♡</p>
                          <p className="text-sm">No favorites yet</p>
                          <p className="text-xs mt-1 opacity-70">
                            Tap the heart on any piece to keep it close
                          </p>
                        </>
                      ) : (
                        <p className="text-sm">No pieces found</p>
                      )}
                    </div>
                  )}

                  {!loadingList &&
                    filteredTracks.map((track, pos) => {
                      const activeTrack = displayTracks[track.index];
                      const isActive = track.index === currentIndex;
                      const prevTrack =
                        pos > 0 ? filteredTracks[pos - 1] : null;
                      const startsNew =
                        boundaries.length > 1 &&
                        (prevTrack === null ||
                          prevTrack.source !== track.source);
                      const count =
                        sections[track.source]?.count ?? 0;

                      return (
                        <div key={`${track.id}-${track.index}`}>
                          {startsNew && count > 0 && (
                            <div className="section-label">
                              <span>
                                {sectionLabels[track.source] ??
                                  `Section ${track.source + 1}`}
                              </span>
                              <span className="rule" />
                              <span className="count">{count} pieces</span>
                            </div>
                          )}

                          <div
                            ref={(el) => {
                              if (el)
                                trackItemRefs.current.set(track.index, el);
                              else trackItemRefs.current.delete(track.index);
                            }}
                            className={`track-row ${
                              isActive ? "is-active" : ""
                            }`}
                            onClick={() => playAt(track.index)}
                          >
                            <span className="num">
                              {formatIndex(track.index + 1)}
                            </span>

                            <div className="w-12 h-9 rounded-[2px] overflow-hidden bg-black/40 shrink-0">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={track.thumbnail}
                                alt=""
                                className="w-full h-full object-cover opacity-90"
                                loading="lazy"
                              />
                            </div>

                            <div className="min-w-0">
                              <p className="meta-title truncate">
                                {activeTrack?.title ||
                                  `Piece ${formatIndex(track.index + 1)}`}
                              </p>
                              <p className="meta-sub truncate">
                                {activeTrack?.artist ||
                                  track.artist ||
                                  "Qawwali archive"}
                              </p>
                            </div>

                            <span className="action hidden sm:inline">
                              {isActive
                                ? isPlaying
                                  ? "Playing"
                                  : "Selected"
                                : "Listen"}
                            </span>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(track.index);
                              }}
                              className={`p-1.5 transition-colors ${
                                favorites.has(track.index)
                                  ? "text-[color:var(--color-gold)]"
                                  : "text-[color:var(--color-muted-dim)] hover:text-[color:var(--color-gold)]"
                              }`}
                              aria-label="Favorite"
                            >
                              <IconHeart filled={favorites.has(track.index)} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>

                <div className="border-t border-[color:var(--color-line)] px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[0.7rem] tracking-[0.14em] uppercase text-[color:var(--color-muted)]">
                  <span>
                    <span className="text-[color:var(--color-gold)] font-serif normal-case tracking-normal text-base mr-1.5">
                      {tracks.length || "—"}
                    </span>
                    Playable pieces
                  </span>
                  <span>
                    <span className="text-[color:var(--color-gold)] font-serif normal-case tracking-normal text-base mr-1.5">
                      {boundaries.length || 1}
                    </span>
                    Sections
                  </span>
                  {duplicatesRemoved > 0 && (
                    <span className="normal-case tracking-normal">
                      {duplicatesRemoved} duplicates removed
                    </span>
                  )}
                  {titlesLoading && (
                    <span className="flex items-center gap-2 normal-case tracking-normal text-[color:var(--color-gold)]">
                      <span className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full spin" />
                      Loading titles…
                    </span>
                  )}
                </div>
              </div>

              {/* Now playing — official YouTube embed */}
              <aside className="lg:sticky lg:top-20">
                <div className="player-card overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--color-line)]">
                    <span className="flex items-center gap-2 text-[0.68rem] tracking-[0.2em] uppercase text-[color:var(--color-gold)]">
                      <span
                        className={`inline-block w-1.5 h-1.5 rounded-full bg-[color:var(--color-gold)] ${
                          isPlaying ? "animate-pulse" : ""
                        }`}
                      />
                      Now in the mehfil
                    </span>
                    <span className="text-[0.68rem] tracking-[0.18em] uppercase text-[color:var(--color-muted)]">
                      {isPlaying ? "Playing" : "Ready"}
                    </span>
                  </div>

                  <div className="player-slot">
                    {currentId ? (
                      <iframe
                        key={`${currentId}-${currentIndex}`}
                        ref={iframeRef}
                        src={embedUrl(currentId, true)}
                        title={displayTitle}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[color:var(--color-muted)]">
                        <div className="w-8 h-8 border border-[color:var(--color-gold)] border-t-transparent rounded-full spin" />
                        <span className="text-xs tracking-[0.18em] uppercase">
                          Opening the mehfil…
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-5 sm:p-6">
                    <p className="text-[0.68rem] tracking-[0.2em] uppercase text-[color:var(--color-gold)] mb-2">
                      {displayArtist}
                    </p>
                    <h3 className="font-serif text-[1.55rem] sm:text-[1.75rem] leading-tight text-[color:var(--color-cream)]">
                      {displayTitle}
                    </h3>
                    <p className="mt-3 text-sm text-[color:var(--color-muted)] leading-relaxed">
                      Press play inside the YouTube player, or use the bar at
                      the bottom. The original YouTube controls remain
                      available so playback stays reliable and familiar.
                    </p>

                    <div className="mt-5 flex flex-wrap gap-2.5">
                      <button className="btn btn-gold" onClick={togglePlay}>
                        {isPlaying ? (
                          <IconPause size={15} />
                        ) : (
                          <IconPlay size={15} />
                        )}
                        {isPlaying ? "Pause" : "Play"}
                      </button>
                      {currentId && (
                        <a
                          href={youtubeWatchUrl(currentId)}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-ghost"
                        >
                          <IconExternal />
                          Open on YouTube
                        </a>
                      )}
                    </div>

                    {tracks.length > 0 && (
                      <p className="mt-5 text-[0.75rem] text-[color:var(--color-muted-dim)]">
                        Piece {currentIndex + 1} of {tracks.length}
                        {boundaries.length > 1 && (
                          <>
                            {" "}
                            ·{" "}
                            {sectionLabels[
                              displayTracks[currentIndex]?.source ?? 0
                            ] ?? ""}
                          </>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              </aside>
            </div>
          </main>

          <footer className="border-t border-[color:var(--color-line)] mt-auto mb-24">
            <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <p className="eyebrow mb-1">Mehfil-e-Qawwali</p>
                <p className="text-sm text-[color:var(--color-muted)]">
                  A digital room for the sound that stays.
                </p>
              </div>
              <p className="text-[0.7rem] text-[color:var(--color-muted-dim)] max-w-sm sm:text-right">
                Portrait: Ustad Nusrat Fateh Ali Khan. Playback via YouTube.
              </p>
            </div>
          </footer>
        </section>

      {/* Playback notice */}
      {notice && (
        <div className="player-notice">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════════
          ALWAYS-ON BOTTOM TRANSPORT BAR
          ════════════════════════════════════════════════ */}
      {isReady && (
        <div className="player-bar">
          <div
            className="player-bar-seek"
            onClick={handleSeek}
            role="slider"
            aria-valuemin={0}
            aria-valuemax={duration || 0}
            aria-valuenow={currentTime}
            aria-label="Seek"
          >
            <div
              className="player-bar-seek-fill"
              style={{
                width: duration
                  ? `${Math.min(100, (currentTime / duration) * 100)}%`
                  : "0%",
              }}
            />
          </div>

          <div className="player-bar-inner">
            <div className="player-bar-meta min-w-0">
              <div className="w-11 h-11 rounded-[2px] overflow-hidden bg-black/40 shrink-0 hidden sm:block">
                {currentId ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumbUrl(currentId, "mq")}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[color:var(--color-cream)] truncate leading-tight">
                  {displayTitle}
                </p>
                <p className="text-[0.7rem] text-[color:var(--color-muted)] truncate mt-0.5">
                  {displayArtist}
                  {tracks.length > 0 && (
                    <span className="opacity-60">
                      {" "}
                      · {currentIndex + 1}/{tracks.length}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="player-bar-controls">
              <button
                onClick={prev}
                className="player-bar-btn"
                aria-label="Previous"
                disabled={tracks.length === 0}
              >
                <IconPrev />
              </button>
              <button
                onClick={togglePlay}
                className="player-bar-btn player-bar-btn-main"
                aria-label={isPlaying ? "Pause" : "Play"}
                disabled={!currentId}
              >
                {isPlaying ? <IconPause size={22} /> : <IconPlay size={22} />}
              </button>
              <button
                onClick={next}
                className="player-bar-btn"
                aria-label="Next"
                disabled={tracks.length === 0}
              >
                <IconNext />
              </button>
            </div>

            <div className="player-bar-side">
              <span className="text-[0.7rem] tabular-nums text-[color:var(--color-muted)] hidden md:inline">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>

              <button
                onClick={toggleMute}
                className="player-bar-btn hidden sm:flex"
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted || volume === 0 ? <IconMute /> : <IconVolume />}
              </button>

              <div
                className="player-bar-volume hidden sm:block"
                onClick={handleVolume}
                role="slider"
                aria-label="Volume"
              >
                <div
                  className="player-bar-volume-fill"
                  style={{ width: `${isMuted ? 0 : volume}%` }}
                />
              </div>

              {currentId && (
                <a
                  href={youtubeWatchUrl(currentId)}
                  target="_blank"
                  rel="noreferrer"
                  className="player-bar-btn hidden lg:flex"
                  aria-label="Open on YouTube"
                  title="Open on YouTube"
                >
                  <IconExternal />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
