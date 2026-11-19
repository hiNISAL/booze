import { BoozeError } from '../core/errors';
import type { Adapter, AdapterRequest, HeaderMap, Progress } from '../types';
import { hasNoBody, parseJSON } from './shared';

export interface FetchAdapterOptions {
  /** Defaults to the global `fetch`, looked up on every request. */
  fetch?: typeof globalThis.fetch;
  /** Extra fetch options such as `credentials` or `mode`. */
  init?: RequestInit;
}

const readWithProgress = async (response: Response, onProgress: (event: Progress) => void): Promise<Uint8Array> => {
  const total = Number(response.headers.get('content-length')) || undefined;
  const reader = response.body!.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    onProgress({ loaded, total });
  }

  const bytes = new Uint8Array(loaded);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return bytes;
};

const readBody = async (response: Response, req: AdapterRequest): Promise<unknown> => {
  if (hasNoBody(req.method, response.status)) return undefined;

  if (req.onDownloadProgress && response.body) {
    const bytes = await readWithProgress(response, req.onDownloadProgress);
    const buffer = bytes.buffer as ArrayBuffer;

    switch (req.responseType) {
      case 'arrayBuffer': return buffer;
      case 'blob': return new Blob([buffer], { type: response.headers.get('content-type') ?? '' });
      case 'text': return new TextDecoder().decode(bytes);
      default: return parseJSON(new TextDecoder().decode(bytes));
    }
  }

  switch (req.responseType) {
    case 'arrayBuffer': return response.arrayBuffer();
    case 'blob': return response.blob();
    case 'text': return response.text();
    default: return parseJSON(await response.text());
  }
};

const headersOf = (response: Response): HeaderMap => {
  const headers: HeaderMap = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return headers;
};

/**
 * The default adapter. Timeouts use an AbortController; download progress is reported when
 * `onDownloadProgress` is set. fetch cannot report upload progress.
 */
export const fetchAdapter = (options: FetchAdapterOptions = {}): Adapter => ({
  name: 'fetch',
  async send(req) {
    const fetchImpl = options.fetch ?? globalThis.fetch;

    if (typeof fetchImpl !== 'function') {
      throw new BoozeError('NO_ADAPTER', 'There is no global fetch here. Pass an adapter to createClient() or configure().');
    }

    const controller = new AbortController();
    const forwardAbort = () => controller.abort(req.signal?.reason);
    let timedOut = false;

    if (req.signal?.aborted) throw new BoozeError('ABORTED', 'The request was aborted.', { cause: req.signal.reason });
    req.signal?.addEventListener('abort', forwardAbort, { once: true });

    const timer = req.timeout
      ? setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, req.timeout)
      : undefined;

    try {
      const response = await fetchImpl(req.url, {
        ...options.init,
        method: req.method,
        headers: req.headers,
        body: req.body as BodyInit | undefined,
        signal: controller.signal,
      });
      const data = await readBody(response, req);

      return { status: response.status, headers: headersOf(response), data, raw: response };
    } catch (error) {
      if (timedOut) throw new BoozeError('TIMEOUT', `No response within ${req.timeout}ms.`, { cause: error });
      if (controller.signal.aborted) throw new BoozeError('ABORTED', 'The request was aborted.', { cause: error });
      throw new BoozeError('NETWORK_ERROR', String((error as Error)?.message ?? error), { cause: error });
    } finally {
      clearTimeout(timer);
      req.signal?.removeEventListener('abort', forwardAbort);
    }
  },
});
