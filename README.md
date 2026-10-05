# Mehfil — free, open-source, ad-free music player

Search music, build a queue, discover by mood, keep a feed of what you love, and **control playback from another device** — all in a glossy dark-glass UI over the glowing MEHFIL sign. No sign-up, no trackers, MIT-licensed.

**Ad-free by design.** Audius — a free, ad-free, decentralised streaming service — is always searched first and plays through a native audio element, so it carries no ads and no embed restrictions. YouTube is kept only as a **fallback** for when Audius has no match, and the UI tells you when that happens.

## Features

- **Search bar (top)** — searches **Audius first** (5 instant results; click to play immediately). If Audius has nothing, it falls back to YouTube and says so. Paste a YouTube link to play it directly.
- **Transport bar (bottom, always on)** — play/pause, previous, next, shuffle, repeat (off / all / one), seek bar, volume & mute.
- **Discover** — mood chips (Sufi & Qawwali, Coke Studio, Ghazal, Lo-fi, Bollywood, Punjabi…) from YouTube, with *Play all* / *Queue all*.
- **Queue** — add to queue, play next, reorder, remove, clear; autoplay continues from the list you played from.
- **Feed** — your ♥ Liked tracks and recently played history (stored only in your browser).
- **Devices** — start a session and scan the QR code (or type the 6-character code) on your phone, tablet or laptop. That device becomes a remote: play, pause, skip, seek, volume, play a track or add to the queue, while music keeps playing on the host. Media keys / lock-screen controls work where the browser supports them.
- **Help & contact** — FAQ for common problems, direct links (Spotify, YouTube, Instagram, LinkedIn, GitHub) and a *Report a bug* button. Friendly error toasts explain what went wrong (blocked videos are skipped automatically).
- Glassy, transparent navbar, panels and player bar; responsive down to small phones; keyboard shortcuts (`Space`, `Shift+←/→`, `M`, `/`).

## About "ad-free"

Audius tracks play through a native audio element with **no ads at all**. YouTube is used only when Audius has no results, and YouTube may show its own ads on those videos — Mehfil doesn't strip them, because that would break YouTube's terms of service.

## Tech

- Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4
- Audius public REST API (ad-free search + direct audio streaming, no key)
- Official YouTube IFrame Player API (fallback playback)
- Keyless server route for search (`/api/search`) — Audius first, YouTube fallback
- Device sync (`/api/connect`) stored in PostgreSQL via Drizzle ORM, with an in-memory fallback

```
src/
├─ app/
│  ├─ page.tsx                # background + <MehfilPlayer />
│  ├─ layout.tsx              # fonts, metadata
│  ├─ globals.css             # glass design system
│  └─ api/
│     ├─ search/route.ts      # YouTube search, pasted links
│     ├─ connect/route.ts     # device sessions: create / state / commands
│     └─ health/route.ts
├─ components/
│  ├─ MehfilPlayer.tsx        # the whole player UI + engines
│  └─ icons.tsx
├─ db/                        # Drizzle schema (device_sessions) + client
└─ lib/                       # youtube.ts, connectStore.ts, config.ts
```

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Environment variables (all optional)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL for reliable device sync (the table is created automatically). Without it, sync runs in memory — fine on a single server. |
| `NEXT_PUBLIC_SITE_URL` | Public URL used for social preview images. |

## Deploy to Vercel

1. Import the GitHub repo at <https://vercel.com/new> and click **Deploy** (defaults are fine).
2. For rock-solid device sync on serverless, add a free Postgres (e.g. Vercel's Neon integration) — it sets `DATABASE_URL` automatically.

## Customising

- Your social links, site links and Discover moods: `src/lib/config.ts`
- Background image: replace `public/images/mehfil-bg.jpg`

## Contact

Spotify · [YouTube](https://www.youtube.com/@DEVKUMARMISTRY-u1f) · [Instagram](https://www.instagram.com/itzur.dev__) · [LinkedIn](https://www.linkedin.com/in/dev-kumar-mistry-3a0030378) · [GitHub](https://github.com/DEV08-cybr)

Found a bug? [Open an issue](https://github.com/DEV08-cybr/Mehfil/issues/new).

## License

MIT — see [LICENSE](./LICENSE).
