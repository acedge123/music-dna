import { describe, expect, it } from "vitest";
import { buildLedger } from "../engine/evidence";
import { authorCritic, compactCriticFacts, criticFacts } from "./critic-editorial";

const labels = { scale: { hi: "intimacy", lo: "spectacle" } };
const l = buildLedger(
  [0, 1, 2].map((i) => ({
    choice_id: `c${i}`,
    pairing_id: `p${i}`,
    pairing_saying: `saying ${i}`,
    tests: ["scale"],
    chosen: { title: `A${i}`, scale: 80 },
    rejected: { title: `B${i}`, scale: 10 },
  })),
  ["scale"],
);

describe("critic speed experiment hook", () => {
  it("live calls (no experiment option) send the full facts and no creative objective", async () => {
    const prompts: string[] = [];
    await authorCritic(l, labels, async (p) => (prompts.push(p), "not json"), { stage: "read" });
    expect(prompts[0]).toContain(JSON.stringify(criticFacts(l, labels)));
    expect(prompts[0]).not.toContain("CREATIVE OBJECTIVE");
  });

  it("compact facts keep only the latest pick's saying", () => {
    const c = compactCriticFacts(l, labels);
    const sayings = c.choices.map((x) => x.post_choice_saying).filter(Boolean);
    expect(sayings).toEqual(["saying 2"]);
  });
});

describe("song fact cards", () => {
  it("are supplied to the critic only when the experiment passes them", async () => {
    const prompts: string[] = [];
    const id = l.entries[0].choice_id!;
    await authorCritic(l, labels, async (p) => (prompts.push(p), "x"), {
      stage: "read",
      experiment: { songFacts: { [id]: { chosen: ["String coda outlasts the band."], rejected: [] } } },
    });
    await authorCritic(l, labels, async (p) => (prompts.push(p), "x"), { stage: "read" });
    expect(prompts[0]).toContain("String coda outlasts the band.");
    expect(prompts.at(-1)).not.toContain("chosen_song_facts");
  });
});
