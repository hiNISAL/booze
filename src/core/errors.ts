import type { BoozeResponse, Context } from '../types';

export type BoozeErrorCode =
  /** The decorated method did not return `request()`. */
  | 'INVALID_RETURN'
  /** `request()` was awaited directly instead of being returned from a decorated method. */
  | 'NOT_DECORATED'
  /** A `:name` placeholder in the path has no value. */
  | 'MISSING_PATH_PARAM'
  /** No usable adapter, e.g. the default fetch adapter where there is no global fetch. */
  | 'NO_ADAPTER'
  /** The signal was aborted, a middleware ended without a result, or `@Before` returned false. */
  | 'ABORTED'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  /** The status did not pass `validateStatus` (default: 2xx). */
  | 'HTTP_ERROR';

export interface BoozeErrorOptions {
  ctx?: Context;
  response?: BoozeResponse;
  cause?: unknown;
}

export class BoozeError extends Error {
  readonly code: BoozeErrorCode;
  ctx?: Context;
  response?: BoozeResponse;

  constructor(code: BoozeErrorCode, message: string, options: BoozeErrorOptions = {}) {
    super(`[booze] ${message}`, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'BoozeError';
    this.code = code;
    this.ctx = options.ctx;
    this.response = options.response;
  }
}

export const isBoozeError = (error: unknown): error is BoozeError => error instanceof BoozeError;
