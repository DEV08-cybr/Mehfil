export const SITE = {
  name: "Mehfil",
  tagline: "Free · open-source · ad-free music player",
  repo: "https://github.com/DEV08-cybr/Mehfil",
  issues: "https://github.com/DEV08-cybr/Mehfil/issues/new",
};

export type SocialId = "spotify" | "youtube" | "instagram" | "linkedin" | "github";

export const SOCIAL_LINKS: { id: SocialId; label: string; href: string }[] = [
  {
    id: "spotify",
    label: "Spotify",
    href: "https://open.spotify.com/user/31rrpry76yjtgec7xnjmwtneuqvu",
  },
  {
    id: "youtube",
    label: "YouTube",
    href: "https://www.youtube.com/@DEVKUMARMISTRY-u1f",
  },
  {
    id: "instagram",
    label: "Instagram",
    href: "https://www.instagram.com/itzur.dev__",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/dev-kumar-mistry-3a0030378",
  },
  {
    id: "github",
    label: "GitHub",
    href: "https://github.com/DEV08-cybr",
  },
];

export interface Mood {
  label: string;
  query: string;
}

export const DISCOVER_MOODS: Mood[] = [
  { label: "Sufi & Qawwali", query: "sufi qawwali" },
  { label: "Nusrat Classics", query: "nusrat fateh ali khan qawwali" },
  { label: "Coke Studio", query: "coke studio pakistan" },
  { label: "Ghazal Nights", query: "ghazal jagjit singh" },
  { label: "Lo-fi Chill", query: "hindi lofi chill" },
  { label: "Bollywood Hits", query: "bollywood hits songs" },
  { label: "Punjabi", query: "punjabi songs" },
  { label: "Indie", query: "indian indie music" },
  { label: "Instrumental", query: "sitar flute instrumental" },
];