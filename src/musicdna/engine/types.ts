// MusicDNA Engine — shared DTOs.
//
// This module is the ONLY thing the engine, its adapters, and external
// consumers (server functions, /api/v1 routes, tests, future Flutter client)
// should import to talk about domain shapes. Keep it free of runtime deps.

export type Vector = Record<string, number>;

export type Lane = string;

export type SongLite = {
  id: string;
  title: string;
  artist: string;
  year?: number | null;
  primary_lane?: Lane | null;
  lane?: Lane | null;
};

export type Pairing = {
  id: string;
  song_a: SongLite;
  song_b: SongLite;
};

export type ChoiceInput = {
  session_id: string;
  pairing_id: string;
  chosen_song_id: string;
  rejected_song_id: string;
  ms_to_decide: number | null;
};

export type Progress = {
  round: number;
  total: number;
  confident_axes: number;
};

export type ArchetypeAssignment = {
  id: string | null;
  name: string;
  score: number; // cosine, 0..1 — strength of fit, NOT a probability
  margin: number; // best - runnerUp, 0..1
  // Bucketed strength-of-fit label used by the Critic voice for hedging.
  // NOT a calibrated probability. See engine/scoring.ts#fitTier.
  fit_tier: 20 | 50 | 80 | 95;
  runners_up: { id: string | null; name: string; score: number }[];
};


export type Reveal = {
  archetype: ArchetypeAssignment;
  tagline: string | null;
  commentary: string;
  defining_choices: {
    chosen: string;
    chosenArtist: string;
    rejected: string;
    rejectedArtist: string;
  }[];
  share_token: string | null;
};

export type EngineError = {
  code:
    | "NOT_FOUND"
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "INVALID_INPUT"
    | "CONFLICT"
    | "UPSTREAM"
    | "INTERNAL";
  message: string;
};
