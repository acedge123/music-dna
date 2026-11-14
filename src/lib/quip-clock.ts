import { QUIP_INTERVAL_MS } from "./critic-wait";

export type QuipClock = { index: number; shownAt: number };

/** Reject stale/doubled callbacks and measure dwell from the actual displayed line. */
export function advanceQuip(clock: QuipClock, expectedIndex: number, now: number, length: number): QuipClock {
  if (clock.index !== expectedIndex || now - clock.shownAt < QUIP_INTERVAL_MS || clock.index >= length - 1) return clock;
  return { index: clock.index + 1, shownAt: now };
}