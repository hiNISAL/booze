/**
 * What happens when a decorated method is called:
 * read config → run the original method → build ctx → run middleware around the core handler.
 */
import { fetchAdapter } from '../adapters/fetch';
import { type FullResult, readRequest } from '../request';
import type { Adapter, Context, HeaderMap, HeaderSource, Middleware, RequestOptions } from '../types';
import { serializeBody } from './body';
import { type BoozeClient, defaultClient } from './client';
import { compose } from './compose';
import { BoozeError } from './errors';
import { callMetadata, type ClassLayer, classLayers, type Metadata, type MethodLayer } from './metadata';
import { appendQuery, fillPath, joinURL, serializeQuery as defaultSerializeQuery } from './url';

const defaultAdapter = fetchAdapter();

const isSuccess = (status: number) => status >= 200 && status < 300;

const lowerCaseKeys = (headers: HeaderMap): HeaderMap =>
  Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));

/** The value of the highest-priority layer that sets `key` (layers are lowest priority first). */
const pick = <L, K extends keyof L>(layers: readonly L[], key: K): L[K] | undefined => {
  for (let i = layers.length - 1; i >= 0; i--) {
    const value = layers[i]![key];
    if (value !== undefined) return value;
  }

  return undefined;
};

export interface Invocation {
  original: (...args: unknown[]) => unknown;
  thisArg: unknown;
  args: unknown[];
  name: string | symbol;
  layer: MethodLayer;
  declaredIn: Metadata;
}

export const invoke = async (call: Invocation): Promise<unknown> => {
  const returned = call.original.apply(call.thisArg, call.args);
  const description = readRequest(returned);

  if (!description) {
    if (typeof (returned as PromiseLike<unknown> | undefined)?.then === 'function') {
      // Don't leave the method's own promise unhandled; the error below explains the problem.
      Promise.resolve(returned).catch(() => {});
    }

    throw new BoozeError(
      'INVALID_RETURN',
      `${String(call.name)}() must return request(...) synchronously; it returned ${describe(returned)}. ` +
      'Async preparation (tokens, signing) belongs in middleware.',
    );
  }

  const classes = classLayers(callMetadata(call.thisArg, call.declaredIn));
  const client: BoozeClient = pick(classes, 'client') ?? defaultClient;
  const ctx = await createContext(call, description.options, classes, client);

  const middleware: Middleware[] = [
    ...client.middleware,
    ...classes.flatMap((layer) => layer.middleware),
    ...call.layer.middleware,
  ];
  const adapter = call.layer.adapter ?? pick(classes, 'adapter') ?? client.options.adapter ?? defaultAdapter;

  try {
    await compose(middleware, (inner) => send(inner, adapter))(ctx);
  } catch (error) {
    if (error instanceof BoozeError) error.ctx ??= ctx;
    throw error;
  }

  if (!Object.hasOwn(ctx, 'result')) {
    throw new BoozeError('ABORTED', 'A middleware ended the request without calling next() or setting ctx.result.', { ctx });
  }

  if (!description.full) return ctx.result;

  return {
    data: ctx.result,
    status: ctx.response?.status ?? 200,
    headers: ctx.response?.headers ?? {},
  } satisfies FullResult<unknown>;
};

const describe = (value: unknown) => {
  if (value === undefined) return 'undefined';
  if (typeof (value as PromiseLike<unknown> | null)?.then === 'function') return 'a promise (is the method async?)';

  return typeof value === 'object' ? 'a plain object' : typeof value;
};

const createContext = async (
  call: Invocation,
  options: RequestOptions,
  classes: ClassLayer[],
  client: BoozeClient,
): Promise<Context> => {
  const { layer } = call;

  if (!layer.method) {
    throw new TypeError(`[booze] ${String(call.name)}() has no HTTP method decorator.`);
  }

  const url = fillPath(joinURL(client.options.baseURL, pick(classes, 'prefix'), layer.path), options.path);

  const ctx: Context = {
    client,
    instance: call.thisArg,
    name: call.name,
    args: call.args,
    request: {
      method: layer.method,
      url,
      query: { ...options.query },
      headers: {},
      body: options.body,
      bodyType: layer.bodyType ?? pick(classes, 'bodyType') ?? client.options.bodyType ?? 'json',
      timeout: options.timeout ?? layer.timeout ?? pick(classes, 'timeout') ?? client.options.timeout,
      signal: options.signal,
      responseType: options.responseType ?? 'json',
      onUploadProgress: options.onUploadProgress,
      onDownloadProgress: options.onDownloadProgress,
      meta: { ...options.meta },
    },
  };

  // Lowest priority first: client → base class → derived class → method → this call.
  const sources: HeaderSource[] = [
    client.options.headers ?? {},
    ...classes.flatMap((cls) => cls.headers),
    ...layer.headers,
    options.headers ?? {},
  ];

  for (const source of sources) {
    const headers = typeof source === 'function' ? await source(ctx) : source;
    Object.assign(ctx.request.headers, lowerCaseKeys(headers));
  }

  return ctx;
};

/** The innermost handler: serialize, call the adapter, check the status. */
const send = async (ctx: Context, adapter: Adapter): Promise<void> => {
  const { request: req, client } = ctx;
  const serializeQuery = client.options.serializeQuery ?? defaultSerializeQuery;

  if (req.signal?.aborted) {
    throw new BoozeError('ABORTED', 'The request was aborted before it was sent.', { ctx, cause: req.signal.reason });
  }

  const headers = lowerCaseKeys(req.headers);
  const body = serializeBody(req.body, req.bodyType, headers, serializeQuery);

  let response;

  try {
    response = await adapter.send({
      method: req.method,
      url: appendQuery(req.url, serializeQuery(req.query)),
      headers,
      body,
      responseType: req.responseType,
      timeout: req.timeout,
      signal: req.signal,
      onUploadProgress: req.onUploadProgress,
      onDownloadProgress: req.onDownloadProgress,
      ctx,
    });
  } catch (error) {
    if (error instanceof BoozeError) throw error;
    throw new BoozeError('NETWORK_ERROR', `Adapter "${adapter.name}" failed: ${String((error as Error)?.message ?? error)}`, { ctx, cause: error });
  }

  ctx.response = response;

  const validateStatus = client.options.validateStatus ?? isSuccess;

  if (!validateStatus(response.status)) {
    throw new BoozeError('HTTP_ERROR', `${req.method} ${req.url} failed with status ${response.status}.`, { ctx, response });
  }

  ctx.result = response.data;
};
