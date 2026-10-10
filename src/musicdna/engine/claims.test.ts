import { describe, expect, it } from "vitest";
import { evaluateClaim } from "./claims";

describe("D01 claim policy", () => {
  it("3–0 supported", () => expect(evaluateClaim(3, 0).status).toBe("supported"));
  it("3–1 qualified", () => expect(evaluateClaim(3, 1)).toMatchObject({ status: "qualified", eligible: true }));
  it("2–2 mixed", () => expect(evaluateClaim(2, 2)).toMatchObject({ status: "mixed", eligible: false }));
  it("2–0 provisional", () => expect(evaluateClaim(2, 0)).toMatchObject({ status: "provisional", eligible: false }));
  it("4–3 below consistency", () => expect(evaluateClaim(4, 3).eligible).toBe(false));
  it("0–0 insufficient", () => expect(evaluateClaim(0, 0).status).toBe("insufficient"));
});
