import type { CurrentReadResult } from "@/musicdna/engine/read";

export type Phase = "slot1" | "slot2" | "slot3" | "playing" | "done";
export type Refined = {
  reaction?: string;
  hypothesis: string;
  lane: string;
  confidence: number;
  secondary_lanes?: string[];
  observation?: string;
  fork?: string;
  stakes?: string;
};
export type Song = {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  lane: string;
  artwork?: { image_url: string; album_title: string | null } | null;
};
export type Pairing = {
  id: string;
  exposure_id?: string | null;
  tests: string[];
  hypothesis: string | null;
  why_good: string | null;
  diagnostic_weight: number;
  song_a: Song;
  song_b: Song;
};
export type Entry = {
  round: number;
  pairing: Pairing;
  chosenSongId: string;
  reaction: string;
  thesis: string;
  hook: string;
  direction: "forming" | "holding" | "contested" | "revising";
  topDim: string | null;
  tier: "observation" | "theory" | "read";
  question: string;
  revision?: CurrentReadResult["revision"];
};

/** Display position counts answered picks only; round remains the server's reaction key. */
export function answeredChoiceNumber(entries: readonly { pairing: Pick<Pairing, "id"> }[], pairingId: string): number {
  return entries.findIndex((entry) => entry.pairing.id === pairingId) + 1;
}
