// Experience contract v1 (ARC02). Opt-in via `X-MusicDNA-Experience: 1`.
// Without the header every route returns its original shape so the shipped
// Flutter build keeps working. See docs/musicdna/experience-contract-v1.md.

export function experienceVersion(request: Request): 0 | 1 {
  return request.headers.get("x-musicdna-experience") === "1" ? 1 : 0;
}

type NextResult = {
  done: boolean;
  round: number;
  confidence: number;
  pairing: unknown;
  answered?: number;
  max_rounds?: number;
  stop_reason?: string | null;
  prompt?: string;
};

export function nextV0(r: NextResult) {
  return { done: r.done, round: r.round, confidence: r.confidence, pairing: r.pairing };
}

export function nextV1(r: NextResult) {
  return {
    contract: 1,
    pairing: r.pairing,
    prompt: r.pairing ? r.prompt ?? null : null,
    progress: { answered: r.answered ?? 0, max_answered: r.max_rounds ?? 6 },
    completion: { done: r.done, reason: r.done ? r.stop_reason ?? "budget" : null },
  };
}
