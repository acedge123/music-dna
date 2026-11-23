import { expect, it } from "vitest";
import { currentSongSearch } from "./song-search-state";

it("new Dreams input cannot show Queen options or allow selection from the old query", () => {
  const visible = currentSongSearch({ query: "Bohemian Rhapsody", status: "success", results: [
    { id: "queen", title: "Bohemian Rhapsody", artist: "Queen", year: 1975 },
  ] }, "Dreams");
  expect(visible.results).toEqual([]);
  expect(visible.status).toBe("pending");
});
it("typing Aloysius does not turn an earlier empty search into a current miss", () => {
  expect(currentSongSearch({ query: "", status: "success", results: [] }, "Aloysius").status).toBe("pending");
});
it("a completed current empty search is distinct from a failed request", () => {
  expect(currentSongSearch({ query: "unknown", status: "success", results: [] }, "unknown").status).toBe("success");
  expect(currentSongSearch({ query: "unknown", status: "error", results: [] }, "unknown").status).toBe("error");
});