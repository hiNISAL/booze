import { BoozeError } from '../core/errors';
import type { Context, HttpMethod, Middleware } from '../types';

export interface RetryOptions {
  /** Retries after the first attempt. Defaults to 2. */
  retries?: number;
  /**
   * Milliseconds to wait before retry number `attempt` (1-based). Defaults to
   * 300 · 2^(attempt − 1). A numeric `Retry-After` response header takes precedence.
   */
  delay?: number | ((attempt: number, error: unknown) => number);
  /** Methods that may be retried. Defaults to the idempotent ones: GET, HEAD, OPTIONS, PUT, DELETE. */
  methods?: HttpMethod[];
  /** HTTP_ERROR statuses that may be retried. Defaults to 408, 429, 500, 502, 503, 504. */
  statuses?: number[];
  /**
   * Replaces the default decision (method allowed, and a NETWORK_ERROR, TIMEOUT or a listed
   * HTTP_ERROR status). ABORTED is never retried.
   */
  when?: (error: unknown, ctx: Context) => boolean;
}

const DEFAULT_METHODS = ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'];
const DEFAULT_STATUSES = [408, 429, 500, 502, 503, 504];

const sleep = (ms: number, signal: AbortSignal | undefined) => new Promise<void>((resolve, reject) => {
  if (signal?.aborted) {
    reject(new BoozeError('ABORTED', 'The request was aborted while waiting to retry.', { cause: signal.reason }));
    return;
  }

  const onAbort = () => {
    clearTimeout(timer);
    reject(new BoozeError('ABORTED', 'The request was aborted while waiting to retry.', { cause: signal?.reason }));
  };
  const timer = setTimeout(() => {
    signal?.removeEventListener('abort', onAbort);
    resolve();
  }, ms);

  signal?.addEventListener('abort', onAbort, { once: true });
});

const retryAfter = (error: unknown): number | undefined => {
  const header = error instanceof BoozeError ? error.response?.headers['retry-after'] : undefined;
  const seconds = header === undefined ? NaN : Number(header);

  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : undefined;
};

/**
 * Retries failed requests by calling `next()` again. Register it outside the middleware whose
 * work should be repeated, e.g. `client.use(retry())` or `@Use(retry({ retries: 3 }))`.
 */
export const retry = (options: RetryOptions = {}): Middleware => {
  const retries = options.retries ?? 2;
  const methods = new Set((options.methods ?? DEFAULT_METHODS).map((method) => method.toUpperCase()));
  const statuses = new Set(options.statuses ?? DEFAULT_STATUSES);

  const shouldRetry = (error: unknown, ctx: Context): boolean => {
    if (!(error instanceof BoozeError) || error.code === 'ABORTED') return false;
    if (options.when) return options.when(error, ctx);
    if (!methods.has(ctx.request.method.toUpperCase())) return false;
    if (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT') return true;

    return error.code === 'HTTP_ERROR' && error.response !== undefined && statuses.has(error.response.status);
  };

  const delayFor = (attempt: number, error: unknown): number => {
    const fromHeader = retryAfter(error);
    if (fromHeader !== undefined) return fromHeader;
    if (typeof options.delay === 'function') return options.delay(attempt, error);

    return options.delay ?? 300 * 2 ** (attempt - 1);
  };

  return async (ctx, next) => {
    for (let attempt = 1; ; attempt++) {
      try {
        await next();
        return;
      } catch (error) {
        if (attempt > retries || !shouldRetry(error, ctx)) throw error;
        await sleep(delayFor(attempt, error), ctx.request.signal);
      }
    }
  };
};
