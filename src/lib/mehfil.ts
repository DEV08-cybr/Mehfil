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

/**
 * Static, deduplicated snapshot of the full queue (ID-based dedupe,
 * handpicked win). Used ONLY if the live /api/playlist scraper fails,
 * so the archive always has every piece.
 */
export const FALLBACK_SECTIONS: { label: string; ids: string[] }[] = [
  {
    label: "Collection I",
    ids: [
      "u_47iOzeVsA","yVmFR_tfnyE","Q7yro9YaTzY","5mHeCj4E8bs","kbBhu3qHZ2E",
      "GwtvQYSBlGU","BPOV3kIYVzw","XuxBY-oT8pc","dFXOsiyCp9o","j9JHRKcZYfQ",
      "IIOtpUKZGHE","lCDMR7TEFew","lFHoPIg9K38","u0SZ92-cPZs","TZ6I3bUHuDM",
      "lPuXiBH-jfg","CMyZkALSqQ4","sHbw-GC6UWQ","wshiW7wTT88","2_pJ6VXapLE",
      "SamNa9sqsr8","bGGYy6bFNp4","ILVu9SUFsaM","ZQQ8acKTh58","nqQ03Mc2sAE",
      "pzJP9OBwpXg","4zAey5G06vI","JeZOyA5HKvg","FckPpZyxLnk","FLHUb5EuoHk",
      "kuF5PLM-aoY","LFENf5TMe80","LrKl39uwWzY","mQqGFFtYhpg","w9g294lXsSg",
      "XXhR2LTHOeQ","HHJk5G3JltI","ecDW-M5nDZ8","mo2rnorih8E",
    ],
  },
  {
    label: "Collection II",
    ids: [
      "gY01irEl8Eo","QuNyMxLlVig","BIOgR38G2Zs","ze45-Y-PexI","d7AqPH-LgmI",
      "GkejOgSZ8qw","UCCA-tsJLpA","ogTjOq0GKiM","XGE0Z6co31Y","Br812W5vA5M",
      "94QB7xfOkqM","zXdk8uoSFMI","C_L2ieICpeI","2RWw0hCbY2g","HZG1GWQw-do",
      "f-s4mM9ls8o","Cwy5eO1lhY0","f3dnF-GmscM","kBgl81yuZPs","8_nLmX0MhFE",
      "2buzoMKiyPE","IROccWiBT-A","ZDRUAlmwbpI","bWo7Ue4mCOM","TU95ovZ5ZxM",
      "MgbXz9n311E","zrk8ahfkKBQ","GhashnQub-0","Ij9SMT53Fn4","-SeyyWpqJA0",
    ],
  },
  {
    label: "Handpicked",
    ids: [
      "mXY5-TK2sJ0","eYSaHXXFIBU","UIPXHsUXVH0","xxjKw7HZQEI","YdLr2md26Qs",
      "PL8QNrDCqo0","PEP_d2aZOng","q89NdfH-P8Q","DKpzCm_nxTo","QPA0HToz3oU",
      "PFxomXeIq4w","8pL87d_v8JY","mYbQLd0lFww",
    ],
  },
];

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