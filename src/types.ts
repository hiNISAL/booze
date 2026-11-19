import type { BoozeClient } from './core/client';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS' | (string & {});

/** How a request body that is not already a native body (FormData, Blob, string…) is serialized. */
export type BodyType = 'json' | 'form' | 'multipart' | 'text' | 'raw';

export type ResponseType = 'json' | 'text' | 'blob' | 'arrayBuffer';

export type HeaderMap = Record<string, string>;

export type Query = Record<string, unknown>;

export interface Progress {
  loaded: number;
  total?: number;
}

/** What a decorated method passes to `request()`. Every field is optional. */
export interface RequestOptions {
  /** Values for `:name` placeholders in the path. */
  path?: Record<string, string | number>;
  /** Appended to the URL for every HTTP method. Keys whose value is `undefined` are skipped. */
  query?: Query;
  /** Serialized according to `@BodyType`. FormData, Blob, ArrayBuffer and strings are sent as-is. */
  body?: unknown;
  /** Headers for this call only; they override every other layer. */
  headers?: HeaderMap;
  signal?: AbortSignal;
  /** Milliseconds. Overrides the client and decorator timeouts. */
  timeout?: number;
  /** Defaults to `'json'`. */
  responseType?: ResponseType;
  onUploadProgress?: (event: Progress) => void;
  onDownloadProgress?: (event: Progress) => void;
  /** Free-form data for middleware. booze itself never reads it. */
  meta?: Record<string, unknown>;
}

/** The request as middleware sees it. Mutations are picked up by the core handler. */
export interface RequestState {
  method: HttpMethod;
  /** baseURL + prefix + path with placeholders filled in, without the query string. */
  url: string;
  query: Query;
  /** Header names are lower-cased. */
  headers: HeaderMap;
  body?: unknown;
  bodyType: BodyType;
  timeout?: number;
  signal?: AbortSignal;
  responseType: ResponseType;
  onUploadProgress?: (event: Progress) => void;
  onDownloadProgress?: (event: Progress) => void;
  meta: Record<string, unknown>;
}

export interface BoozeResponse {
  status: number;
  /** Header names are lower-cased. */
  headers: HeaderMap;
  /** Parsed according to `responseType`; `undefined` for an empty body. */
  data: unknown;
  /** The adapter's raw response (e.g. the fetch `Response`). */
  raw: unknown;
}

export interface Context {
  readonly client: BoozeClient;
  /** `this` of the call: the instance, or the class for a static method. */
  readonly instance: unknown;
  /** Name of the decorated method. */
  readonly name: string | symbol;
  readonly args: readonly unknown[];
  request: RequestState;
  response?: BoozeResponse;
  /** What the decorated method resolves to. Defaults to `response.data`. */
  result?: unknown;
}

export type Next = () => Promise<void>;

export type Middleware = (ctx: Context, next: Next) => unknown;

/** The request handed to an adapter: URL already includes the query, body already serialized. */
export interface AdapterRequest {
  method: HttpMethod;
  url: string;
  headers: HeaderMap;
  body?: unknown;
  responseType: ResponseType;
  timeout?: number;
  signal?: AbortSignal;
  onUploadProgress?: (event: Progress) => void;
  onDownloadProgress?: (event: Progress) => void;
  ctx: Context;
}

/**
 * Sends a request. Must not reject on non-2xx statuses (booze checks the status itself);
 * should reject with BoozeError codes NETWORK_ERROR, TIMEOUT or ABORTED.
 */
export interface Adapter {
  name: string;
  send(request: AdapterRequest): Promise<BoozeResponse>;
}

export type HeaderSource = HeaderMap | ((ctx: Context) => HeaderMap | Promise<HeaderMap>);
