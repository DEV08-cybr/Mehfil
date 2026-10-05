import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function box(size = 18) {
  return { width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true } as const;
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/* ── Player ─────────────────────────────────────────────── */

export function IPlay({ size, ...p }: IconProps) {
  return (
    <svg {...box(size)} fill="currentColor" {...p}>
      <path d="M8 5.6v12.8a1 1 0 0 0 1.52.85l10.2-6.4a1 1 0 0 0 0-1.7L9.52 4.75A1 1 0 0 0 8 5.6z" />
    </svg>
  );
}

export function IPause({ size, ...p }: IconProps) {
  return (
    <svg {...box(size)} fill="currentColor" {...p}>
      <rect x="6" y="5" width="4.2" height="14" rx="1.2" />
      <rect x="13.8" y="5" width="4.2" height="14" rx="1.2" />
    </svg>
  );
}

export function INext({ size, ...p }: IconProps) {
  return (
    <svg {...box(size)} fill="currentColor" {...p}>
      <path d="M5 6.3v11.4a.9.9 0 0 0 1.38.76l8.6-5.7a.9.9 0 0 0 0-1.52l-8.6-5.7A.9.9 0 0 0 5 6.3z" />
      <rect x="16.4" y="5" width="2.6" height="14" rx="1" />
    </svg>
  );
}

export function IPrev({ size, ...p }: IconProps) {
  return (
    <svg {...box(size)} fill="currentColor" {...p}>
      <path d="M19 6.3v11.4a.9.9 0 0 1-1.38.76l-8.6-5.7a.9.9 0 0 1 0-1.52l8.6-5.7A.9.9 0 0 1 19 6.3z" />
      <rect x="5" y="5" width="2.6" height="14" rx="1" />
    </svg>
  );
}

export function IShuffle({ size, ...p }: IconProps) {
  return (
    <svg {...box(size)} {...stroke} {...p}>
      <path d="M16 3h5v5" />
      <path d="M4 20 21 3" />
      <path d="M21 16v5h-5" />
      <path d="m15 15 6 6" />
      <path d="M4 4l5 5" />
    </svg>
  );
}

export function IRepeat({ size, ...p }: IconProps) {
  return (
    <svg {...box(size)} {...stroke} {...p}>
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

export function IRepeatOne({ size, ...p }: IconProps) {
  return (
    <svg {...box(size)} {...stroke} {...p}>
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
      <path d="M11 10h1.2v4.5" />
    </svg>
  );
}

export function IVolume({ size, ...p }: IconProps) {
  return (
    <svg {...box(size)} {...stroke} {...p}>
      <path d="M11 5 6.5 9H3v6h3.5L11 19z" fill="currentColor" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

export function IMute({ size, ...p }: IconProps) {
  return (
    <svg {...box(size)} {...stroke} {...p}>
      <path d="M11 5 6.5 9H3v6h3.5L11 19z" fill="currentColor" />
      <path d="m16 9.5 5 5M21 9.5l-5 5" />
    </svg>
  );
}

/* ── Actions ────────────────────────────────────────────── */

export function ISearch({ size, ...p }: IconProps) {
  return (
    <svg {...box(size)} {...stroke} {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.6-3.6" />
    </svg>
  );
}

export function IHeart({ size, filled, ...p }: IconProps & { filled?: boolean }) {
  return (
    <svg {...box(size)} {...stroke} fill={filled ? "currentColor" : "none"} {...p}>
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.3l7.8-7.8 1-1.1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  );
}

export function IQueueAdd({ size, ...p }: IconProps) {
  return (
    <svg {...box(size)} {...stroke} {...p}>
      <path d="M3 6h12M3 12h12M3 18h8" />
      <path d="M18 14v7M14.5 17.5h7" />
    </svg>
  );
}

export function IPlayNext({ size, ...p }: IconProps) {
  return (
    <svg {...box(size)} {...stroke} {...p}>
      <path d="M3 7h10M3 12h7M3 17h7" />
      <path d="M15 10v8l6-4z" fill="currentColor" />
    </svg>
  );
}

export function IQueue({ size, ...p }: IconProps) {
  return (
    <svg {...box(size)} {...stroke} {...p}>
      <path d="M3 6h18M3 12h18M3 18h11" />
    </svg>
  );
}

export function IClose({ size, ...p }: IconProps) {
  return (
    <svg {...box(size)} {...stroke} {...p}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function IUp({ size, ...p }: IconProps) {
  return (
    <svg {...box(size)} {...stroke} {...p}>
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

export function IDown({ size, ...p }: IconProps) {
  return (
    <svg {...box(size)} {...stroke} {...p}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function IDevices({ size, ...p }: IconProps) {
  return (
    <svg {...box(size)} {...stroke} {...p}>
      <rect x="2" y="4" width="14" height="10" rx="2" />
      <path d="M6 18h6M9 14v4" />
      <rect x="17.5" y="8" width="4.5" height="12" rx="1.4" />
    </svg>
  );
}

export function ICompass({ size, ...p }: IconProps) {
  return (
    <svg {...box(size)} {...stroke} {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </svg>
  );
}

export function IFeed({ size, ...p }: IconProps) {
  return (
    <svg {...box(size)} {...stroke} {...p}>
      <path d="M3 12h4l3-8 4 16 3-8h4" />
    </svg>
  );
}

export function IHelp({ size, ...p }: IconProps) {
  return (
    <svg {...box(size)} {...stroke} {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.4a2.6 2.6 0 1 1 3.7 2.35c-.7.33-1.2 1-1.2 1.8v.45" />
      <path d="M12 17.4h.01" />
    </svg>
  );
}

export function IExternal({ size, ...p }: IconProps) {
  return (
    <svg {...box(size)} {...stroke} {...p}>
      <path d="M14 3h7v7" />
      <path d="M10 14 21 3" />
      <path d="M21 14v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h6" />
    </svg>
  );
}

export function ICopy({ size, ...p }: IconProps) {
  return (
    <svg {...box(size)} {...stroke} {...p}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

export function IMusic({ size, ...p }: IconProps) {
  return (
    <svg {...box(size)} {...stroke} {...p}>
      <path d="M9 18V5l11-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="17" cy="16" r="3" />
    </svg>
  );
}

export function ISpinner({ size, ...p }: IconProps) {
  return (
    <svg {...box(size)} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" {...p}>
      <path d="M12 3a9 9 0 1 0 9 9" opacity={0.9} />
    </svg>
  );
}

/* ── Brands ─────────────────────────────────────────────── */

export function ISpotify({ size, ...p }: IconProps) {
  return (
    <svg {...box(size)} fill="currentColor" {...p}>
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.59 14.43a.62.62 0 0 1-.86.21c-2.35-1.44-5.3-1.76-8.79-.96a.62.62 0 1 1-.28-1.21c3.82-.87 7.1-.5 9.72 1.1.3.18.39.57.21.86zm1.22-2.73a.78.78 0 0 1-1.07.26c-2.69-1.65-6.79-2.13-9.97-1.17a.78.78 0 1 1-.45-1.49c3.64-1.1 8.2-.55 11.24 1.32.36.22.48.7.25 1.08zm.11-2.84C14.93 8.95 9.73 8.76 6.6 9.7a.93.93 0 1 1-.54-1.79c3.57-1.08 9.29-.87 12.97 1.27a.94.94 0 0 1-.97 1.6z" />
    </svg>
  );
}

export function IYouTube({ size, ...p }: IconProps) {
  return (
    <svg {...box(size)} fill="currentColor" {...p}>
      <path d="M23.5 6.2a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.51A3.02 3.02 0 0 0 .5 6.2 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.8 3.02 3.02 0 0 0 2.12 2.14c1.88.51 9.38.51 9.38.51s7.5 0 9.38-.51a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.8zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z" />
    </svg>
  );
}

export function IInstagram({ size, ...p }: IconProps) {
  return (
    <svg {...box(size)} {...stroke} strokeWidth={1.7} {...p}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.3" cy="6.7" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ILinkedIn({ size, ...p }: IconProps) {
  return (
    <svg {...box(size)} fill="currentColor" {...p}>
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.8 0 0 .78 0 1.74v20.5C0 23.2.8 24 1.77 24h20.45c.98 0 1.78-.8 1.78-1.76V1.74C24 .78 23.2 0 22.22 0z" />
    </svg>
  );
}

export function IGitHub({ size, ...p }: IconProps) {
  return (
    <svg {...box(size)} fill="currentColor" {...p}>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2c-3.2.7-3.88-1.36-3.88-1.36-.53-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.12 3.05.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}