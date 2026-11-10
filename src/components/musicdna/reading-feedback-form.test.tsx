import { it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ReadingFeedbackForm } from "./reading-feedback-form";
const base = {
  version: 1,
  selection: null,
  status: "ready" as const,
  error: null,
  onSelect: () => {},
  onSubmit: () => {},
  onReload: () => {},
};
it("makes rating optional with no preselected answer", () => {
  const h = renderToStaticMarkup(<ReadingFeedbackForm {...base} />);
  expect(h).toContain("How accurate is this reading?");
  expect(h).toContain("Optional");
  expect(h.match(/type="radio"/g)).toHaveLength(3);
  expect(h).not.toContain('checked=""');
  expect(h).toContain('disabled=""');
});
it("shows the confirmed saved rating and its exact version without offering another vote", () => {
  const h = renderToStaticMarkup(
    <ReadingFeedbackForm {...base} version={2} selection="mixed" status="saved" />,
  );
  expect(h).toContain("Saved: Mixed");
  expect(h).toContain("reading version 2");
  expect(h).not.toContain("Save rating");
});
it("distinguishes unavailable reads from an empty rating and freezes uncertain submissions", () => {
  const unavailable = renderToStaticMarkup(
    <ReadingFeedbackForm {...base} status="unavailable" error="Try loading again" />,
  );
  expect(unavailable).toContain('role="alert"');
  expect(unavailable).not.toContain('type="radio"');
  const pending = renderToStaticMarkup(
    <ReadingFeedbackForm {...base} status="uncertain" selection="accurate" error="Not confirmed" />,
  );
  expect(pending).toContain("Retry this rating");
  expect(pending).toContain('<fieldset disabled=""');
});
