import type { SongSuggestion } from "./song-search";

export type SongSearchState = {
  query: string;
  status: "pending" | "success" | "error";
  results: SongSuggestion[];
};

// A render for new input must never reuse the previous query's options or empty state.
export function currentSongSearch(state: SongSearchState, query: string): SongSearchState {
  return state.query === query ? state : { query, status: "pending", results: [] };
}