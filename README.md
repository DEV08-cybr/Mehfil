# Mehfil-e-Qawwali · The Sufi Listening Room

> A quiet digital room for qawwali — for late nights, old memories, long drives, prayer, poetry, and the moments when a voice says what you cannot.

An elegant, transparent-themed listening room built with **Next.js (App Router)** and the **YouTube IFrame Player API**. The YouTube player runs hidden in the background (audio-only), while a custom-built interface handles browsing and playback.

## Features

- **Landing page** — "Not just music. *A Mehfil.*" with a sepia portrait of Ustad Nusrat Fateh Ali Khan.
- **The Archive** — a hand-curated, numbered listening shelf.
- **Continuous queue** — multiple YouTube playlists + handpicked singles chained into one seamless mehfil.
- **Always-on bottom transport bar** — play / pause / previous / next, seek, volume, mute — visible on every screen.
- **No visible YouTube iframe** — playback runs quietly through a hidden engine; the UI shows artwork, titles and artists.
- **Real metadata** — titles, artists and thumbnails resolved via YouTube oEmbed (no API key needed), cached in `localStorage`.
- **Search & favourites** — full-text filter and heart-saved pieces (persisted locally).
- **Automatic de-duplication** across playlists and singles.
- **Keyboard shortcuts** — `Space` play/pause, `← →` previous/next, `M` mute.
- Transparent, atmospheric, glass-blur aesthetic with gold accents.

## Tech stack

- Next.js 16 · React 19 · TypeScript
- Tailwind CSS v4
- YouTube IFrame Player API (playback engine)
- YouTube oEmbed (metadata)
- Drizzle ORM / PostgreSQL (healthcheck)

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Production build

```bash
npm run build
npm start
```

## Deploy to Vercel (free, ~1 minute)

No environment variables are required.

**Easiest (browser):**
1. Push this repo to GitHub.
2. Go to https://vercel.com/new and **Import** the repository.
3. Vercel auto-detects Next.js — leave every default and click **Deploy**.
4. You get a public `https://<your-project>.vercel.app` URL. Every future
   `git push` redeploys automatically.

**Or with the CLI:**
```bash
npm i -g vercel
vercel            # preview deploy
vercel --prod     # production deploy
```

## Editing the music

All sources live in **`src/lib/mehfil.ts`** → `SEGMENTS`.
Mix full playlists and individual videos freely; the app chains them in order
and removes duplicates automatically.

```ts
export const SEGMENTS: Segment[] = [
  { label: "Collection I", type: "playlist", id: "PL…" },
  { label: "Handpicked",   type: "videos",  ids: ["videoId1", "videoId2"] },
];
```

## License

Portrait artwork is AI-generated and used illustratively. Audio and video are
streamed from YouTube via the official embed; all rights belong to their
respective owners.
