/* Everything plays back-to-back as one continuous mehfil.
   Order here = playback order. Mix playlists and single videos freely. */
export type Segment =
  | { label: string; type: "playlist"; id: string }
  | { label: string; type: "videos"; ids: string[] };

export const SEGMENTS: Segment[] = [
  {
    label: "Collection I",
    type: "playlist",
    id: "PLeHcbwsMVRm4RVm8cm9gbgCuivb_HKcar",
  },
  {
    label: "Collection II",
    type: "playlist",
    id: "PL3-p4AK-3bWaTuQEEggG4P_4lR-JZbDXe",
  },
  {
    label: "Handpicked",
    type: "videos",
    ids: [
      "mXY5-TK2sJ0",
      "eYSaHXXFIBU",
      "UIPXHsUXVH0",
      "xxjKw7HZQEI",
      "YdLr2md26Qs",
      "PL8QNrDCqo0",
      "PEP_d2aZOng",
      "q89NdfH-P8Q",
      "DKpzCm_nxTo",
      "QPA0HToz3oU",
      "PFxomXeIq4w",
      "8pL87d_v8JY",
      "mYbQLd0lFww",
    ],
  },
];

export const SEGMENT_LABELS = SEGMENTS.map((s) => s.label);

export const FIRST_PLAYLIST = SEGMENTS.find(
  (s): s is Extract<Segment, { type: "playlist" }> => s.type === "playlist"
)!;

export const STORAGE_FAVS = "mehfil-favorites-v6";
export const STORAGE_TITLES = "mehfil-titles-v6";

export function thumbUrl(id: string, quality: "hq" | "mq" | "sd" = "hq"): string {
  const map = {
    hq: "hqdefault",
    mq: "mqdefault",
    sd: "sddefault",
  } as const;
  return `https://i.ytimg.com/vi/${id}/${map[quality]}.jpg`;
}

export function formatIndex(n: number): string {
  return String(n).padStart(2, "0");
}

export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}