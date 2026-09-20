# Mehfil-e-Qawwali · The Sufi Listening Room

> A quiet digital room for qawwali — for late nights, old memories, long drives, prayer, poetry, and the moments when a voice says what you cannot.

An elegant, atmospheric listening room built with **Next.js (App Router)** and the **official YouTube embed**. Two complete YouTube playlists plus a set of handpicked singles are chained, de-duplicated and presented as one continuous *mehfil*, controlled by an always-on transport bar.

---

## Features

- **Landing page** — *“Not just music. **A Mehfil.**”* with a framed portrait of **Ustad Nusrat Fateh Ali Khan** and three guiding principles.
- **The Archive** — a hand-curated, numbered listening shelf with real thumbnails, titles and artists.
- **Continuous queue** — multiple YouTube playlists **and** individual videos are merged in order into one seamless queue.
- **Automatic de-duplication** — overlapping videos across sources are kept only once (first occurrence wins), with the removed count shown.
- **Always-on bottom transport bar** — play / pause / previous / next, a click-to-seek progress bar, elapsed/total time, volume and mute — visible on every screen.
- **Official YouTube embed** — the reliable, policy-compliant stream lives in the *Now in the Mehfil* card and is driven from the custom bottom bar over the embed JS API (`postMessage`).
- **Real metadata** — a server route resolves the playlist contents and titles; YouTube **oEmbed** fills any missing titles (no API key required). Results are cached in `localStorage`.
- **Resilient** — if the live playlist scraper is ever blocked, a baked-in snapshot (`FALLBACK_SECTIONS`) keeps the full archive playable. Blocked/private videos auto-skip.
- **Search & favourites** — full-text filter and heart-saved pieces, persisted locally.
- **Keyboard shortcuts** — `Space` play/pause, `←` / `→` previous/next, `M` mute.
- Transparent, warm, glass-blur aesthetic with gold accents and film-grain atmosphere.

---

## Tech stack

- **Next.js 16** (App Router) · **React 19** · **TypeScript**
- **Tailwind CSS v4**
- **YouTube embed / IFrame JS API** (playback, controlled over `postMessage`)
- **YouTube oEmbed** (titles, keyless)
- Server-side playlist resolution in Route Handlers
- No database or environment variables required (healthcheck is dependency-free)

---

## Project structure

```
src/
├─ app/
│  ├─ layout.tsx                 # Fonts (Inter, Cormorant Garamond, Amiri) + metadata
│  ├─ page.tsx                   # Renders <MehfilApp />
│  ├─ globals.css                # Theme, atmospheric background, transport bar
│  └─ api/
│     ├─ playlist/route.ts       # Resolves playlist + single-video queue
│     ├─ playlist-titles/route.ts# Batch keyless oEmbed title lookup
│     └─ health/route.ts         # Dependency-free health probe
├─ components/
│  └─ MehfilApp.tsx              # Landing + Archive, embed bridge, transport bar
└─ lib/
   ├─ mehfil.ts                  # SEGMENTS config + FALLBACK_SECTIONS snapshot
   └─ youtube.ts                 # Server-side playlist/metadata helpers

public/images/nusrat-portrait.jpg
```

---

## Run locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Production build

```bash
npm run build
npm start
```

---

## Editing the music

All sources live in **`src/lib/mehfil.ts`** → `SEGMENTS`. Mix full playlists and
individual videos freely; the app chains them in order and removes duplicates
automatically.

```ts
export type Segment =
  | { label: string; type: "playlist"; id: string }
  | { label: string; type: "videos"; ids: string[] };

export const SEGMENTS: Segment[] = [
  { label: "Collection I", type: "playlist", id: "PL…" },
  { label: "Collection II", type: "playlist", id: "PL…" },
  { label: "Handpicked",   type: "videos", ids: ["videoId1", "videoId2"] },
];
```

> If a video or playlist is private/region-locked it is skipped automatically.
> The 11-character codes in *videos* are video IDs; codes beginning with `PL`
> that point to a whole collection should be added as a `playlist` segment.

---

## Deploy to Vercel (free, ~1 minute)

No environment variables are required for playback.

**Browser (easiest):**
1. Push this repo to GitHub.
2. Go to <https://vercel.com/new> and **Import** the repository.
3. Vercel auto-detects Next.js — leave the defaults and click **Deploy**.
4. You get a public `https://<your-project>.vercel.app` URL. Every future
   `git push` redeploys automatically.

**CLI:**
```bash
npm i -g vercel
vercel            # preview deploy
vercel --prod     # production deploy
```

> **Playback note:** browsers require a genuine user click before media can
> play with sound. Pressing **Enter the Mehfil**, a track, or the play button
> mounts an autoplay-enabled frame within that click, so playback starts
> reliably. The YouTube frame is kept visible in the *Now in the Mehfil* card
> on purpose — fully hidden frames are autoplay-restricted by the browser and
> by YouTube's embed policies.

---

## Credits & license

- Portrait of **Ustad Nusrat Fateh Ali Khan** sourced from Wikimedia Commons
  (artwork by *Attersaab / Bhushan Kumar Atter*, **CC BY-SA 4.0**).
- All audio and video is streamed from YouTube through the official embed;
  rights belong to the respective artists, labels and rights holders. This
  project is a non-commercial fan listening room.
