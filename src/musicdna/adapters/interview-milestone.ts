import { halftimeSummary } from "../engine/halftime";
import type { Exchange } from "./session-history";

/** UI guidance from frozen history, never a new claim or completion decision. */
export function interviewMilestone(exchanges: Exchange[], completed: boolean) {
  if (completed) return null;
  const choices = exchanges.filter((e) => e.type === "choice");
  const answered = choices.length;
  if (answered !== 3 && answered !== 4) return null;
  const entries = choices.map((choice, index) => {
    const read = exchanges.find((e) => e.type === "read" && e.answered === index + 1);
    return {
      chosenTitle: choice.chosen?.title ?? "",
      topDim: read?.type === "read" ? (read.top_dim ?? null) : null,
      revised: read?.type === "read" && read.revised,
      direction:
        read?.type === "read"
          ? (read.direction as "forming" | "holding" | "contested" | "revising")
          : undefined,
    };
  });
  return {
    answered,
    title: answered === 3 ? "The story isn't settled." : "I have an initial reading.",
    summary:
      answered === 3
        ? entries.some((e) => !e.chosenTitle)
          ? "Halfway there. The story stays open."
          : halftimeSummary(entries)
        : "See my take now, or give me two more picks to challenge it.",
    continue_label: answered === 3 ? "Three more" : "Give me two more",
    can_finish: answered === 4,
  };
}
