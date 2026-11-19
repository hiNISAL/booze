import { BoozeError } from './core/errors';
import type { HeaderMap, RequestOptions } from './types';

declare const brand: unique symbol;

/**
 * What a decorated method returns. To the type system it is a `Promise<T>`, which is exactly
 * what calling the decorated method gives you. The brand stops a plain object or an async
 * method from being accepted where a request is expected.
 */
export interface BoozeRequest<T> extends Promise<T> {
  readonly [brand]: T;
}

/** What `request.full<T>()` resolves to. */
export interface FullResult<T> {
  /** The result after middleware, the same value `request<T>()` would resolve to. */
  data: T;
  /** The response status; 200 when a middleware answered without making a request. */
  status: number;
  /** Lower-case response headers; empty when a middleware answered without making a request. */
  headers: HeaderMap;
}

/** Internal: what a decorated method hands to booze. */
export interface RequestDescription {
  options: RequestOptions;
  full: boolean;
}

// Symbol.for so that two copies of booze (e.g. ESM and CJS) still recognize each other's requests.
const REQUEST = Symbol.for('booze.request');

class RequestDescriptor {
  readonly [REQUEST]: RequestDescription;

  constructor(description: RequestDescription) {
    this[REQUEST] = description;
  }

  // At runtime a descriptor is not a promise. If it is used as one, the method that returned it
  // was not decorated; say so instead of silently resolving to the descriptor.
  private notDecorated(): Promise<never> {
    return Promise.reject(new BoozeError(
      'NOT_DECORATED',
      'request() was used as a promise. Return it from a method decorated with @Get, @Post, etc.',
    ));
  }

  then<A = never, B = never>(onFulfilled?: (value: never) => A, onRejected?: (reason: unknown) => B): Promise<A | B> {
    return this.notDecorated().then(onFulfilled, onRejected);
  }

  catch<B = never>(onRejected?: (reason: unknown) => B): Promise<B> {
    return this.notDecorated().catch(onRejected);
  }

  finally(onFinally?: () => void): Promise<never> {
    return this.notDecorated().finally(onFinally);
  }
}

export interface RequestFunction {
  /**
   * Describes the request made by a decorated method. `T` is the final result after middleware
   * (e.g. after unwrapping `{ code, data }`), and becomes the method's return type.
   *
   * ```ts
   * @Get('/users/:id')
   * get(id: number) {
   *   return request<User>({ path: { id } });
   * }
   * ```
   */
  <T = unknown>(options?: RequestOptions): BoozeRequest<T>;

  /** Like `request<T>()`, but resolves to `{ data, status, headers }`. */
  full<T = unknown>(options?: RequestOptions): BoozeRequest<FullResult<T>>;
}

export const request: RequestFunction = Object.assign(
  <T = unknown>(options: RequestOptions = {}): BoozeRequest<T> =>
    new RequestDescriptor({ options, full: false }) as unknown as BoozeRequest<T>,
  {
    full: <T = unknown>(options: RequestOptions = {}): BoozeRequest<FullResult<T>> =>
      new RequestDescriptor({ options, full: true }) as unknown as BoozeRequest<FullResult<T>>,
  },
);

/** The description behind a value returned by `request()`, or undefined for anything else. */
export const readRequest = (value: unknown): RequestDescription | undefined =>
  typeof value === 'object' && value !== null && REQUEST in value
    ? (value as RequestDescriptor)[REQUEST]
    : undefined;
