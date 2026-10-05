export type Source = "youtube" | "audius";

/** One playable item, normalised across YouTube and SoundCloud. */
export interface Track {
  /** Stable unique key, e.g. "youtube:dQw4w9WgXcQ" */
  key: string;
  source: Source;
  /** YouTube video id, or the SoundCloud permalink URL */
  id: string;
  title: string;
  artist: string;
  /** Human readable, e.g. "4:12" (may be empty) */
  duration: string;
  thumbnail: string;
  /** Link to the original page */
  url: string;
}