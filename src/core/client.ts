import type { Adapter, BodyType, HeaderMap, Middleware, Query } from '../types';

export interface ClientOptions {
  /** Prepended to every path unless the class prefix or the path is an absolute URL. */
  baseURL?: string;
  headers?: HeaderMap;
  /** Defaults to `'json'`. */
  bodyType?: BodyType;
  /** Milliseconds. */
  timeout?: number;
  /** Defaults to the built-in fetch adapter. */
  adapter?: Adapter;
  /** Which statuses resolve. Defaults to 2xx; anything else rejects with HTTP_ERROR. */
  validateStatus?: (status: number) => boolean;
  /** Replaces the built-in query (and form body) serializer, e.g. `qs.stringify`. */
  serializeQuery?: (query: Query) => string;
}

/**
 * Holds client-wide options and middleware. Everything is read when a request is made,
 * so changes apply to classes that were defined earlier.
 */
export class BoozeClient {
  readonly options: ClientOptions;
  readonly middleware: Middleware[] = [];

  constructor(options: ClientOptions = {}) {
    this.options = { ...options, headers: { ...options.headers } };
  }

  /** Adds middleware. Middleware registered first runs outermost. */
  use(...middleware: Middleware[]): this {
    this.middleware.push(...middleware);

    return this;
  }

  /** Updates options. `headers` are merged into the existing ones; other options are replaced. */
  configure(options: ClientOptions): this {
    const { headers, ...rest } = options;

    Object.assign(this.options, rest);
    if (headers) this.options.headers = { ...this.options.headers, ...headers };

    return this;
  }
}

export const createClient = (options?: ClientOptions): BoozeClient => new BoozeClient(options);

/** Used by classes without `@Client`. */
export const defaultClient: BoozeClient = createClient();

/** Updates the default client's options. */
export const configure = (options: ClientOptions): BoozeClient => defaultClient.configure(options);
