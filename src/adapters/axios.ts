/**
 * Sends requests through axios (an optional peer dependency). Supports upload and download
 * progress. booze has already serialized the body and built the URL, so axios's own
 * transforms, baseURL handling and status checks are switched off.
 */
import { BoozeError } from '../core/errors';
import type { Adapter, Progress } from '../types';
import { hasNoBody, normalizeHeaders, parseJSON } from './shared';

interface AxiosProgressEvent {
  loaded: number;
  total?: number;
}

interface AxiosResponseLike {
  status: number;
  headers: Record<string, unknown> | { toJSON(): Record<string, unknown> };
  data: unknown;
}

/** The part of an axios instance this adapter uses; any `axios.create()` instance fits. */
export interface AxiosLike {
  request(config: Record<string, unknown>): Promise<AxiosResponseLike>;
}

const progress = (listener: ((event: Progress) => void) | undefined) =>
  listener && ((event: AxiosProgressEvent) => listener({ loaded: event.loaded, total: event.total || undefined }));

const toBoozeError = (error: unknown): BoozeError => {
  const { code, name, message } = (error ?? {}) as { code?: string; name?: string; message?: string };

  if (code === 'ERR_CANCELED' || name === 'CanceledError') {
    return new BoozeError('ABORTED', 'The request was aborted.', { cause: error });
  }

  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') {
    return new BoozeError('TIMEOUT', message ?? 'The request timed out.', { cause: error });
  }

  return new BoozeError('NETWORK_ERROR', message ?? String(error), { cause: error });
};

const loadAxios = async (): Promise<AxiosLike> => {
  try {
    const module = await import('axios') as unknown as { default?: AxiosLike } & AxiosLike;
    return module.default ?? module;
  } catch (cause) {
    throw new BoozeError('NO_ADAPTER', 'axiosAdapter() needs the "axios" package. Install it or pass an axios instance.', { cause });
  }
};

/** @param instance An axios instance (e.g. from `axios.create()`); defaults to the axios package. */
export const axiosAdapter = (instance?: AxiosLike): Adapter => {
  let axios: Promise<AxiosLike> | undefined = instance && Promise.resolve(instance);

  return {
    name: 'axios',
    async send(req) {
      const client = await (axios ??= loadAxios().catch((error) => {
        axios = undefined;
        throw error;
      }));

      let response: AxiosResponseLike;

      try {
        response = await client.request({
          url: req.url,
          method: req.method,
          headers: req.headers,
          data: req.body,
          responseType: req.responseType === 'arrayBuffer' ? 'arraybuffer' : req.responseType === 'blob' ? 'blob' : 'text',
          timeout: req.timeout ?? 0,
          signal: req.signal,
          onUploadProgress: progress(req.onUploadProgress),
          onDownloadProgress: progress(req.onDownloadProgress),
          validateStatus: () => true,
          transformRequest: [(data: unknown) => data],
          transformResponse: [(data: unknown) => data],
        });
      } catch (error) {
        throw toBoozeError(error);
      }

      const headers = 'toJSON' in response.headers && typeof response.headers.toJSON === 'function'
        ? response.headers.toJSON()
        : response.headers as Record<string, unknown>;

      let data: unknown = response.data;

      if (hasNoBody(req.method, response.status)) data = undefined;
      else if (req.responseType === 'json') data = parseJSON(typeof data === 'string' ? data : String(data ?? ''));

      return { status: response.status, headers: normalizeHeaders(headers), data, raw: response };
    },
  };
};
