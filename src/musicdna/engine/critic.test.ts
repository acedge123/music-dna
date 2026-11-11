import { describe, expect, it } from "vitest";
import { CRITIC_PERSONA, CRITIC_VOICE_EDITORIAL } from "./critic";

describe("critic voice constants", () => {
  it("persona embeds the hard-rules block", () => {
    expect(CRITIC_PERSONA).toContain("HARD RULES:");
    expect(CRITIC_PERSONA).toContain("no platitudes");
    expect(CRITIC_PERSONA).toContain('no "music lover"');
  });

  it("persona forbids the corporate-assistant tells", () => {
    for (const banned of ['no "vibes"', 'no "journey"', "no therapy-speak"]) {
      expect(CRITIC_PERSONA).toContain(banned);
    }
  });

  it("editorial voice keeps the persona rules while making questions optional", () => {
    expect(CRITIC_VOICE_EDITORIAL).toContain(CRITIC_PERSONA.split("\n\nTHE JOB:")[0]);
    expect(CRITIC_VOICE_EDITORIAL).toContain(CRITIC_PERSONA.split("HARD RULES:")[1]);
    expect(CRITIC_VOICE_EDITORIAL).toContain(
      "a question is optional, never a promised future test",
    );
    expect(CRITIC_VOICE_EDITORIAL).not.toContain("Land on a question or a half-promise");
    expect(CRITIC_VOICE_EDITORIAL).toContain("One observation per sentence");
  });
});
