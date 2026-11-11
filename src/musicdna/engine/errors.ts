// MusicDNA Engine — typed errors.
//
// The engine never throws bare `Error`s for expected failure modes. Routes
// and server-fns catch `EngineError` and translate it to an HTTP status +
// the uniform `{ error: { code, message } }` envelope.

import type { EngineError } from "./types";

export class EngineErrorException extends Error implements EngineError {
  readonly code: EngineError["code"];
  constructor(code: EngineError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "EngineError";
  }
}

const CODE_TO_STATUS: Record<EngineError["code"], number> = {
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  INVALID_INPUT: 400,
  CONFLICT: 409,
  UPSTREAM: 502,
  INTERNAL: 500,
};

function engineErrorStatus(code: EngineError["code"]): number {
  return CODE_TO_STATUS[code] ?? 500;
}

function isEngineError(e: unknown): e is EngineErrorException {
  return e instanceof EngineErrorException;
}
