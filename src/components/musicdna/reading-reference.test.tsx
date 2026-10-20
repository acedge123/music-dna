import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ReadingResult } from "./reading-result";
import { SongChoices } from "./song-choices";
import { ReadMoment } from "./read-moment";
import { ReadingConversation } from "./reading-conversation";
import { readingExamples, parseReadingContent } from "@/lib/reading-content";
import suite from "../../../fixtures/musicdna/product-parity-v1.json";
const cached = suite.responses.stable.result;
const content = {
  synthesis: cached.headline,
  kept_choosing: cached.supporting_choices,
  counter_reads: [],
  result_version: 1,
};
describe("web reading reference presentation", () => {
  it("limits the lead evidence to two distinct examples without discarding full details", () => {
    const c = {
      ...content,
      kept_choosing: [
        { ...content.kept_choosing[0], examples: ["first", "second", "third"] },
        { ...content.kept_choosing[0], tradeoff: "another", examples: ["first", "fourth"] },
      ],
    };
    expect(readingExamples(c)).toEqual(["first", "second"]);
    const html = renderToStaticMarkup(<ReadingResult content={c} />);
    expect(html).toContain("See the full reading");
    expect(html).toContain("third");
  });
  it("keeps the balanced fixture inconclusive instead of flattering the listener", () => {
    const h = renderToStaticMarkup(
      <ReadingResult
        content={{
          synthesis: suite.responses.balanced.result.headline,
          kept_choosing: [],
          counter_reads: [],
        }}
      />,
    );
    expect(h).toContain(suite.responses.balanced.result.headline);
    expect(h).not.toContain("Broad ear");
    expect(h).not.toContain("refused to collapse");
  });
  it("renders selected state semantically and with a visible label", () => {
    const p = suite.catalog[0];
    const h = renderToStaticMarkup(
      <SongChoices
        songs={[p.song_a, p.song_b]}
        selectedId={p.song_a.id}
        busy={true}
        onChoose={() => {}}
      />,
    );
    expect(h).toContain('aria-pressed="true"');
    expect(h).toContain("Your choice");
    expect(h).toContain('aria-busy="true"');
    expect(h.match(/disabled=""/g)).toHaveLength(2);
  });
  it("shows the original claim and the actual contradicting choice in a revision", () => {
    const h = renderToStaticMarkup(
      <ReadMoment
        read={{
          tier: "theory",
          direction: "revising",
          thesis: "Server revision",
          question: "",
          revision: {
            previous_claim: "Server previous claim",
            previous_axis: "scale",
            changed_by: { chosen: "Chosen song", rejected: "Rejected song" },
            new_interpretation: "Server revision",
          },
        }}
      />,
    );
    expect(h).toContain("Server previous claim");
    expect(h).toContain("Chosen song over Rejected song");
    expect(h).toContain("Server revision");
  });
  it("preserves an uncertain draft and provides a same-message retry", () => {
    const h = renderToStaticMarkup(
      <ReadingConversation
        messages={[]}
        draft="Uncertain draft"
        onDraft={() => {}}
        onSend={() => {}}
        busy={false}
        pending={{ mutationId: "same-key", message: "Uncertain draft" }}
        error="Still pending"
        hasOlder={false}
        onOlder={() => {}}
      />,
    );
    expect(h).toContain("Uncertain draft");
    expect(h).toContain("Retry this message");
    expect(h).toContain("readOnly");
    expect(h).toContain('role="alert"');
  });
  it("rejects malformed saved content rather than rendering an invented reading", () => {
    expect(
      parseReadingContent({ synthesis: "headline", kept_choosing: "not evidence" }),
    ).toBeNull();
    expect(parseReadingContent(content)?.synthesis).toBe(cached.headline);
  });
});
