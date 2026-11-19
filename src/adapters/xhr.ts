/**
 * Sends requests with XMLHttpRequest. Use it for upload progress (fetch cannot report it) or
 * for older browsers.
 */
import { BoozeError } from '../core/errors';
import type { Adapter, HeaderMap, Progress } from '../types';
import { hasNoBody, parseJSON } from './shared';

export interface XhrAdapterOptions {
  /** Send cookies with cross-origin requests. */
  withCredentials?: boolean;
}

const parseHeaders = (raw: string): HeaderMap => {
  const headers: HeaderMap = {};

  for (const line of raw.trim().split(/[\r\n]+/)) {
    const index = line.indexOf(':');
    if (index <= 0) continue;

    const key = line.slice(0, index).trim().toLowerCase();
    const value = line.slice(index + 1).trim();
    headers[key] = key in headers ? `${headers[key]}, ${value}` : value;
  }

  return headers;
};

const progress = (listener: (event: Progress) => void) => (event: ProgressEvent) =>
  listener({ loaded: event.loaded, total: event.lengthComputable ? event.total : undefined });

export const xhrAdapter = (options: XhrAdapterOptions = {}): Adapter => ({
  name: 'xhr',
  send(req) {
    return new Promise((resolve, reject) => {
      const XHR = (globalThis as { XMLHttpRequest?: typeof XMLHttpRequest }).XMLHttpRequest;

      if (!XHR) {
        reject(new BoozeError('NO_ADAPTER', 'There is no XMLHttpRequest here. Use fetchAdapter() or axiosAdapter() instead.'));
        return;
      }

      if (req.signal?.aborted) {
        reject(new BoozeError('ABORTED', 'The request was aborted.', { cause: req.signal.reason }));
        return;
      }

      const xhr = new XHR();
      const abort = () => xhr.abort();
      const settle = (finish: () => void) => () => {
        req.signal?.removeEventListener('abort', abort);
        finish();
      };

      xhr.open(req.method, req.url, true);
      for (const [key, value] of Object.entries(req.headers)) xhr.setRequestHeader(key, value);

      xhr.responseType = req.responseType === 'arrayBuffer' ? 'arraybuffer' : req.responseType === 'blob' ? 'blob' : 'text';
      if (req.timeout) xhr.timeout = req.timeout;
      if (options.withCredentials) xhr.withCredentials = true;
      if (req.onDownloadProgress) xhr.addEventListener('progress', progress(req.onDownloadProgress));
      if (req.onUploadProgress && xhr.upload) xhr.upload.addEventListener('progress', progress(req.onUploadProgress));

      xhr.onload = settle(() => {
        let data: unknown = xhr.response;

        if (hasNoBody(req.method, xhr.status)) data = undefined;
        else if (req.responseType === 'json') data = parseJSON(xhr.responseText);

        resolve({ status: xhr.status, headers: parseHeaders(xhr.getAllResponseHeaders()), data, raw: xhr });
      });
      xhr.onerror = settle(() => reject(new BoozeError('NETWORK_ERROR', `${req.method} ${req.url} failed.`)));
      xhr.ontimeout = settle(() => reject(new BoozeError('TIMEOUT', `No response within ${req.timeout}ms.`)));
      xhr.onabort = settle(() => reject(new BoozeError('ABORTED', 'The request was aborted.', { cause: req.signal?.reason })));

      req.signal?.addEventListener('abort', abort, { once: true });
      xhr.send((req.body ?? null) as XMLHttpRequestBodyInit | null);
    });
  },
});
