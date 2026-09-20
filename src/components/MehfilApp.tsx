"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FIRST_PLAYLIST,
  SEGMENTS,
  SEGMENT_LABELS,
  STORAGE_FAVS,
  STORAGE_TITLES,
  formatIndex,
  thumbUrl,
  youtubeWatchUrl,
} from "@/lib/mehfil";

/* ================================================================
   YouTube IFrame API types
   ================================================================ */

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: {
      Player: new (
        el: string | HTMLElement,
        config: Record<string, unknown>
      ) => YTPlayerInstance;
      PlayerState: {
        UNSTARTED: -1;
        ENDED: 0;
        PLAYING: 1;
        PAUSED: 2;
        BUFFERING: 3;
        CUED: 5;
      };
    };
  }
}

interface YTPlayerInstance {
  playVideo: () => void;
  pauseVideo: () => void;
  nextVideo: () => void;
  previousVideo: () => void;
  playVideoAt: (index: number) => void;
  seekTo: (seconds: number, allowAhead: boolean) => void;
  setVolume: (vol: number) => void;
  getVolume: () => number;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  getPlayerState: () => number;
  getCurrentTime: () => number;
  getDuration: () => number;
  getVideoData: () => {
    title: string;
    author: string;
    video_id: string;
  };
  getPlaylist: () => string[] | undefined;
  getPlaylistIndex: () => number;
  cuePlaylist: (config: {
    playlist: string[];
    index?: number;
    startSeconds?: number;
  }) => void;
  loadPlaylist: (config: {
    playlist: string[];
    index?: number;
    startSeconds?: number;
  }) => void;
  destroy: () => void;
}

/* ================================================================
   Helpers
   ================================================================ */

function formatTime(sec: number): string {
  if (!sec || !isFinite(sec) || isNaN(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function capturePlaylistIds(listId: string): Promise<string[]> {
  return new Promise((resolve) => {
    let settled = false;
    let temp: YTPlayerInstance | null = null;

    const holder = document.createElement("div");
    holder.setAttribute("aria-hidden", "true");
    holder.style.cssText =
      "position:fixed;bottom:0;left:0;width:1px;height:1px;opacity:0.01;overflow:hidden;pointer-events:none;";
    document.body.appendChild(holder);

    const finish = (ids: string[]) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        temp?.destroy();
      } catch {
        /* ignore */
      }
      holder.remove();
      resolve(ids);
    };

    const timer = setTimeout(() => finish([]), 25_000);

    try {
      temp = new window.YT.Player(holder, {
        width: 1,
        height: 1,
        playerVars: {
          listType: "playlist",
          list: listId,
          autoplay: 0,
          controls: 0,
          modestbranding: 1,
        },
        events: {
          onReady: () => {
            try {
              const ids = temp?.getPlaylist?.() ?? [];
              finish(Array.isArray(ids) ? ids : []);
            } catch {
              finish([]);
            }
          },
          onError: () => finish([]),
        },
      });
    } catch {
      finish([]);
    }
  });
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
  const [currentTitle, setCurrentTitle] = useState("");
  const [currentArtist, setCurrentArtist] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);

  const [videoIds, setVideoIds] = useState<string[]>([]);
  const [boundaries, setBoundaries] = useState<number[]>([0]);
  const [merging, setMerging] = useState(false);
  const [duplicatesRemoved, setDuplicatesRemoved] = useState(0);
  const [trackTitles, setTrackTitles] = useState<Record<string, string>>({});
  const [titlesLoading, setTitlesLoading] = useState(false);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [showFavorites, setShowFavorites] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const playerRef = useRef<YTPlayerInstance | null>(null);
  const playerInitRef = useRef(false);
  const readyRef = useRef(false);
  const errorStreakRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackItemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const archiveRef = useRef<HTMLElement | null>(null);

  /* ── Derived ────────────────────────────────────────── */

  const sourceOf = useCallback(
    (i: number) => {
      let s = 0;
      for (let b = 0; b < boundaries.length; b++) {
        if (i >= boundaries[b]) s = b;
      }
      return s;
    },
    [boundaries]
  );

  const tracks = useMemo(
    () =>
      videoIds.map((id, i) => {
        const raw = trackTitles[id] || "";
        const parsed = raw
          ? parseTitle(raw)
          : { title: `Piece ${formatIndex(i + 1)}`, artist: "" };
        return {
          id,
          index: i,
          title: parsed.title,
          artist: parsed.artist || currentArtist || "Qawwali archive",
          rawTitle: raw || parsed.title,
          thumbnail: thumbUrl(id),
          source: boundaries.length > 1 ? sourceOf(i) : 0,
        };
      }),
    [videoIds, trackTitles, boundaries, sourceOf, currentArtist]
  );

  const filteredTracks = useMemo(() => {
    let list = tracks;
    if (showFavorites) list = list.filter((t) => favorites.has(t.index));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          t.rawTitle.toLowerCase().includes(q)
      );
    }
    return list;
  }, [tracks, favorites, showFavorites, searchQuery]);

  const current = tracks[currentIndex];
  const currentId = videoIds[currentIndex] || "";
  const displayTitle =
    current?.title || currentTitle || "Preparing the mehfil…";
  const displayArtist =
    current?.artist || currentArtist || "The Sufi Listening Room";

  const sectionCounts = useMemo(() => {
    return SEGMENT_LABELS.map((_, i) => {
      const start = boundaries[i] ?? 0;
      const end = boundaries[i + 1] ?? videoIds.length;
      return Math.max(0, end - start);
    });
  }, [boundaries, videoIds.length]);

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
    localStorage.setItem(STORAGE_FAVS, JSON.stringify([...favorites]));
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
      localStorage.setItem(STORAGE_TITLES, JSON.stringify(trackTitles));
    }
  }, [trackTitles]);

  /* ── Time ticker ────────────────────────────────────── */

  const startTimeUpdate = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      try {
        setCurrentTime(p.getCurrentTime());
        setDuration(p.getDuration());
      } catch {
        /* ignore */
      }
    }, 400);
  }, []);

  const stopTimeUpdate = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  /* ── Player callbacks ───────────────────────────────── */

  const updateTrackInfo = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    try {
      const data = p.getVideoData();
      const idx = p.getPlaylistIndex();
      if (typeof idx === "number" && idx >= 0) setCurrentIndex(idx);
      if (data.title) {
        const parsed = parseTitle(data.title);
        setCurrentTitle(parsed.title);
        setCurrentArtist(parsed.artist || data.author || "");
        if (data.video_id) {
          setTrackTitles((prev) => ({ ...prev, [data.video_id]: data.title }));
        }
      } else if (data.author) {
        setCurrentArtist(data.author);
      }
      setDuration(p.getDuration());
      setCurrentTime(p.getCurrentTime());
    } catch {
      /* ignore */
    }
  }, []);

  const chainSegments = useCallback(
    async (firstIds: string[]) => {
      setMerging(true);
      try {
        const rest = SEGMENTS.slice(1);
        const results = await Promise.all(
          rest.map((seg) =>
            seg.type === "playlist"
              ? capturePlaylistIds(seg.id)
              : Promise.resolve<string[]>(seg.ids)
          )
        );

        const seen = new Set<string>();
        let dropped = 0;
        const dedupe = (ids: string[]) =>
          ids.filter((id) => {
            if (!id) return false;
            if (seen.has(id)) {
              dropped += 1;
              return false;
            }
            seen.add(id);
            return true;
          });

        const combined: string[] = [];
        const starts: number[] = [];

        starts.push(0);
        combined.push(...dedupe(firstIds));

        results.forEach((ids) => {
          starts.push(combined.length);
          combined.push(...dedupe(ids));
        });

        const p = playerRef.current;
        // Only swap the player's queue if new tracks were actually added —
        // re-cueing the same list would stop whatever is playing.
        if (p && combined.length > firstIds.length) {
          try {
            const state = p.getPlayerState();
            const wasPlaying = state === 1 || state === 3; // PLAYING / BUFFERING
            const oldIndex =
              typeof p.getPlaylistIndex() === "number"
                ? p.getPlaylistIndex()
                : 0;
            const oldId = firstIds[oldIndex];
            const newIndex = oldId ? combined.indexOf(oldId) : 0;
            const safeIndex = newIndex >= 0 ? newIndex : 0;
            if (wasPlaying) {
              // loadPlaylist keeps audio running through the swap
              p.loadPlaylist({
                playlist: combined,
                index: safeIndex,
                startSeconds: 0,
              });
            } else {
              p.cuePlaylist({
                playlist: combined,
                index: safeIndex,
                startSeconds: 0,
              });
            }
            updateTrackInfo();
          } catch {
            /* ignore */
          }
        }

        setVideoIds(combined);
        setBoundaries(starts);
        setDuplicatesRemoved(dropped);
      } finally {
        setMerging(false);
      }
    },
    [updateTrackInfo]
  );

  const onPlayerReady = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    readyRef.current = true;
    setIsReady(true);

    // Make sure the generated iframe carries the autoplay feature policy
    const iframe = document.querySelector<HTMLIFrameElement>(
      "#yt-engine iframe"
    );
    if (iframe) {
      iframe.setAttribute(
        "allow",
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      );
      iframe.setAttribute("allowfullscreen", "true");
    }

    try {
      setVolume(p.getVolume());
    } catch {
      /* ignore */
    }

    const ids = p.getPlaylist();
    if (ids && ids.length > 0) setVideoIds(ids);

    updateTrackInfo();
    void chainSegments(ids ?? []);
  }, [updateTrackInfo, chainSegments]);

  /* A blocked / deleted / private video must not freeze the mehfil —
     skip it automatically, and only surface a notice after many failures. */
  const onPlayerError = useCallback(() => {
    errorStreakRef.current += 1;
    if (errorStreakRef.current <= 6) {
      window.setTimeout(() => {
        try {
          playerRef.current?.nextVideo();
        } catch {
          /* ignore */
        }
      }, 300);
    } else {
      setNotice(
        "Playback is restricted in this browser. Tap “Open on YouTube” to listen there."
      );
    }
  }, []);

  const onStateChange = useCallback(
    (event: { data: number }) => {
      if (!window.YT) return;
      const S = window.YT.PlayerState;
      switch (event.data) {
        case S.PLAYING:
          errorStreakRef.current = 0;
          setNotice(null);
          setIsPlaying(true);
          startTimeUpdate();
          updateTrackInfo();
          break;
        case S.PAUSED:
          setIsPlaying(false);
          stopTimeUpdate();
          break;
        case S.ENDED:
          setIsPlaying(false);
          stopTimeUpdate();
          break;
        case S.BUFFERING:
        case S.CUED:
          updateTrackInfo();
          break;
      }
    },
    [updateTrackInfo, startTimeUpdate, stopTimeUpdate]
  );

  /* ── Initialize hidden player ───────────────────────── */

  useEffect(() => {
    if (playerInitRef.current) return;
    playerInitRef.current = true;

    const init = () => {
      try {
        const target = document.getElementById("yt-engine");
        if (!target) {
          setError("Player engine missing.");
          return;
        }
        playerRef.current = new window.YT.Player("yt-engine", {
          // Real render size keeps the browser from throttling or
          // autoplay-blocking the frame; CSS makes it invisible.
          height: "180",
          width: "320",
          playerVars: {
            listType: "playlist",
            list: FIRST_PLAYLIST.id,
            autoplay: 0,
            controls: 0,
            modestbranding: 1,
            rel: 0,
            iv_load_policy: 3,
            disablekb: 1,
            fs: 0,
            enablejsapi: 1,
            playsinline: 1,
            origin:
              typeof window !== "undefined" ? window.location.origin : "",
          },
          events: {
            onReady: onPlayerReady,
            onStateChange: onStateChange,
            onError: onPlayerError,
          },
        });
      } catch {
        setError("Could not start the listening engine. Please refresh.");
      }
    };

    if (window.YT && window.YT.Player) {
      init();
    } else {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.onerror = () =>
        setError(
          "Could not reach YouTube. Check your connection and refresh."
        );
      const first = document.getElementsByTagName("script")[0];
      first.parentNode?.insertBefore(tag, first);
      window.onYouTubeIframeAPIReady = init;
    }

    const timeout = setTimeout(() => {
      if (!readyRef.current) {
        setError(
          "The mehfil is taking too long to open. Please refresh the page."
        );
      }
    }, 25_000);

    return () => {
      clearTimeout(timeout);
      stopTimeUpdate();
    };
  }, [onPlayerReady, onStateChange, onPlayerError, stopTimeUpdate]);

  /* ── Titles ─────────────────────────────────────────── */

  useEffect(() => {
    if (videoIds.length === 0) return;
    const missing = videoIds.filter((id) => !trackTitles[id]);
    if (missing.length === 0) return;

    let cancelled = false;

    async function fetchTitles() {
      setTitlesLoading(true);
      try {
        const res = await fetch("/api/playlist-titles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoIds: missing }),
        });
        if (!res.ok) return;
        const data: { titles?: Record<string, string> } = await res.json();
        if (!cancelled && data.titles) {
          setTrackTitles((prev) => ({ ...prev, ...data.titles }));
        }
      } catch {
        /* silent */
      } finally {
        if (!cancelled) setTitlesLoading(false);
      }
    }

    fetchTitles();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoIds.length]);

  /* ── Scroll active track ────────────────────────────── */

  useEffect(() => {
    if (view !== "archive") return;
    const el = trackItemRefs.current.get(currentIndex);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [currentIndex, view]);

  /* ── Controls ───────────────────────────────────────── */

  const play = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    try {
      const state = p.getPlayerState();
      // -1 unstarted, 5 cued → playVideo() alone can stall on a cued list;
      // playVideoAt forces the current index to load.
      if (state === -1 || state === 5) {
        const idx =
          typeof p.getPlaylistIndex() === "number" && p.getPlaylistIndex() >= 0
            ? p.getPlaylistIndex()
            : 0;
        p.playVideoAt(idx);
      } else {
        p.playVideo();
      }
      setIsPlaying(true);
    } catch {
      // Last resort: load the combined queue fresh at the current index
      try {
        const ids = playerRef.current?.getPlaylist?.() ?? [];
        if (ids.length > 0) {
          p.loadPlaylist({ playlist: ids, index: 0 });
        }
      } catch {
        /* ignore */
      }
    }
  }, []);

  const pause = useCallback(() => {
    try {
      playerRef.current?.pauseVideo();
    } catch {
      /* ignore */
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) pause();
    else play();
  }, [isPlaying, play, pause]);

  const playAt = useCallback(
    (idx: number) => {
      setCurrentIndex(idx);
      const p = playerRef.current;
      if (!p) return;
      try {
        p.playVideoAt(idx);
        setIsPlaying(true);
      } catch {
        // Index may be out of range if the merged list isn't loaded yet
        try {
          if (videoIds.length > 0) {
            p.loadPlaylist({ playlist: videoIds, index: idx });
            setIsPlaying(true);
          }
        } catch {
          /* ignore */
        }
      }
    },
    [videoIds]
  );

  const next = useCallback(() => {
    try {
      playerRef.current?.nextVideo();
    } catch {
      if (videoIds.length === 0) return;
      playAt((currentIndex + 1) % videoIds.length);
    }
  }, [videoIds.length, currentIndex, playAt]);

  const prev = useCallback(() => {
    try {
      playerRef.current?.previousVideo();
    } catch {
      if (videoIds.length === 0) return;
      playAt((currentIndex - 1 + videoIds.length) % videoIds.length);
    }
  }, [videoIds.length, currentIndex, playAt]);

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const p = playerRef.current;
      if (!p || !duration) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / rect.width)
      );
      try {
        p.seekTo(pct * duration, true);
        setCurrentTime(pct * duration);
      } catch {
        /* ignore */
      }
    },
    [duration]
  );

  const handleVolume = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const p = playerRef.current;
      if (!p) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / rect.width)
      );
      const vol = Math.round(pct * 100);
      try {
        p.setVolume(vol);
        setVolume(vol);
        if (vol > 0 && isMuted) {
          p.unMute();
          setIsMuted(false);
        }
      } catch {
        /* ignore */
      }
    },
    [isMuted]
  );

  const toggleMute = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    try {
      if (isMuted) {
        p.unMute();
        setIsMuted(false);
      } else {
        p.mute();
        setIsMuted(true);
      }
    } catch {
      /* ignore */
    }
  }, [isMuted]);

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
      if (startPlaying && isReady) play();
    },
    [isReady, play]
  );

  /* ── Keyboard ───────────────────────────────────────── */

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

  const showBar = isReady;

  /* ================================================================
     RENDER
     ================================================================ */

  return (
    <div className={`mehfil-stage ${showBar ? "has-player-bar" : ""}`}>
      {/* Hidden YouTube audio engine — rendered at real size so the
          browser never throttles/autoplay-blocks it, but fully invisible */}
      <div aria-hidden className="yt-engine-hidden">
        <div id="yt-engine" />
      </div>

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
          ARCHIVE
          ════════════════════════════════════════════════ */}
      {view === "archive" && (
        <section ref={archiveRef} className="min-h-screen flex flex-col">
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
                A hand-curated listening shelf. Press play from the bar below —
                no YouTube chrome, just the mehfil.
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
                  {!isReady && !error && (
                    <div className="py-20 text-center text-[color:var(--color-muted)]">
                      <div className="w-8 h-8 border border-[color:var(--color-gold)] border-t-transparent rounded-full spin mx-auto mb-4" />
                      <p className="text-sm">Opening the archive…</p>
                    </div>
                  )}

                  {error && (
                    <div className="py-16 px-6 text-center">
                      <p className="text-sm text-[color:var(--color-cream-dim)] mb-4">
                        {error}
                      </p>
                      <button
                        className="btn btn-gold"
                        onClick={() => window.location.reload()}
                      >
                        Try again
                      </button>
                    </div>
                  )}

                  {isReady && filteredTracks.length === 0 && !error && (
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

                  {filteredTracks.map((track, pos) => {
                    const isActive = track.index === currentIndex;
                    const prevTrack =
                      pos > 0 ? filteredTracks[pos - 1] : null;
                    const startsNew =
                      boundaries.length > 1 &&
                      (prevTrack === null ||
                        prevTrack.source !== track.source);
                    const count = sectionCounts[track.source] ?? 0;

                    return (
                      <div key={`${track.id}-${track.index}`}>
                        {startsNew && count > 0 && (
                          <div className="section-label">
                            <span>
                              {SEGMENT_LABELS[track.source] ??
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
                          className={`track-row ${isActive ? "is-active" : ""}`}
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
                              {track.title}
                            </p>
                            <p className="meta-sub truncate">{track.artist}</p>
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
                            aria-label={
                              favorites.has(track.index)
                                ? "Remove favorite"
                                : "Save favorite"
                            }
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
                      {videoIds.length || "—"}
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
                  {(merging || titlesLoading) && (
                    <span className="flex items-center gap-2 normal-case tracking-normal text-[color:var(--color-gold)]">
                      <span className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full spin" />
                      {merging ? "Merging sections…" : "Loading titles…"}
                    </span>
                  )}
                </div>
              </div>

              {/* Now playing art card — no iframe */}
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
                      {isReady ? (isPlaying ? "Playing" : "Ready") : "Loading"}
                    </span>
                  </div>

                  <div className="relative aspect-square sm:aspect-[4/3] bg-black/40 overflow-hidden">
                    {currentId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumbUrl(currentId)}
                        alt={displayTitle}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-[color:var(--color-muted)]">
                        <div className="w-8 h-8 border border-[color:var(--color-gold)] border-t-transparent rounded-full spin" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[rgba(8,6,4,0.85)] via-transparent to-transparent" />

                    <button
                      onClick={togglePlay}
                      disabled={!isReady}
                      className="absolute inset-0 flex items-center justify-center group"
                      aria-label={isPlaying ? "Pause" : "Play"}
                    >
                      <span className="w-16 h-16 rounded-full bg-[color:var(--color-gold)] text-[#1a140c] flex items-center justify-center shadow-xl opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all">
                        {isPlaying ? (
                          <IconPause size={26} />
                        ) : (
                          <IconPlay size={26} />
                        )}
                      </span>
                    </button>
                  </div>

                  <div className="p-5 sm:p-6">
                    <p className="text-[0.68rem] tracking-[0.2em] uppercase text-[color:var(--color-gold)] mb-2">
                      {displayArtist}
                    </p>
                    <h3 className="font-serif text-[1.55rem] sm:text-[1.75rem] leading-tight text-[color:var(--color-cream)]">
                      {displayTitle}
                    </h3>
                    <p className="mt-3 text-sm text-[color:var(--color-muted)] leading-relaxed">
                      Playback runs quietly in the background. Use the bar at
                      the bottom for play, pause, previous, and next.
                    </p>

                    <div className="mt-5 flex flex-wrap gap-2.5">
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
                      <button className="btn btn-ghost" onClick={next}>
                        Next piece
                      </button>
                    </div>

                    {videoIds.length > 0 && (
                      <p className="mt-5 text-[0.75rem] text-[color:var(--color-muted-dim)]">
                        Piece {currentIndex + 1} of {videoIds.length}
                        {boundaries.length > 1 && (
                          <>
                            {" "}
                            · {SEGMENT_LABELS[sourceOf(currentIndex)] ?? ""}
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
                Portrait inspired by the classical image of Ustad Nusrat Fateh
                Ali Khan.
              </p>
            </div>
          </footer>
        </section>
      )}

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
      {showBar && (
        <div className="player-bar">
          {/* Seek */}
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
            {/* Now playing mini */}
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
                  {videoIds.length > 0 && (
                    <span className="opacity-60">
                      {" "}
                      · {currentIndex + 1}/{videoIds.length}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Transport */}
            <div className="player-bar-controls">
              <button
                onClick={prev}
                className="player-bar-btn"
                aria-label="Previous"
                disabled={!isReady}
              >
                <IconPrev />
              </button>
              <button
                onClick={togglePlay}
                className="player-bar-btn player-bar-btn-main"
                aria-label={isPlaying ? "Pause" : "Play"}
                disabled={!isReady}
              >
                {isPlaying ? <IconPause size={22} /> : <IconPlay size={22} />}
              </button>
              <button
                onClick={next}
                className="player-bar-btn"
                aria-label="Next"
                disabled={!isReady}
              >
                <IconNext />
              </button>
            </div>

            {/* Time + volume */}
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