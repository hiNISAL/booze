/**
 * JSONP: loads the URL as a <script> that calls a global callback. Browser only, GET only;
 * headers, body and response status are not available.
 */
import { BoozeError } from '../core/errors';
import { appendQuery } from '../core/url';
import { Adapter as AdapterDecorator, type ConfigDecorator } from '../decorators/shared';
import type { Adapter } from '../types';

export interface JsonpOptions {
  /** Query parameter that carries the callback name. Defaults to `'callback'`. */
  callbackParam?: string;
  /**
   * A fixed callback name, for servers that require one. Defaults to a unique name per request;
   * with a fixed name, concurrent requests to the same adapter would collide.
   */
  callbackName?: string;
}

interface ScriptLike {
  src: string;
  async: boolean;
  onerror: ((event: unknown) => void) | null;
  remove(): void;
}

interface DocumentLike {
  createElement(tag: 'script'): ScriptLike;
  head?: { appendChild(node: ScriptLike): unknown } | null;
  body?: { appendChild(node: ScriptLike): unknown } | null;
}

let sequence = 0;

export const jsonpAdapter = (options: JsonpOptions = {}): Adapter => ({
  name: 'jsonp',
  send(req) {
    return new Promise((resolve, reject) => {
      const doc = (globalThis as { document?: DocumentLike }).document;

      if (req.method.toUpperCase() !== 'GET') {
        reject(new TypeError(`[booze] JSONP only supports GET, not ${req.method}.`));
        return;
      }

      if (!doc) {
        reject(new BoozeError('NO_ADAPTER', 'JSONP needs a browser document.'));
        return;
      }

      if (req.signal?.aborted) {
        reject(new BoozeError('ABORTED', 'The request was aborted.', { cause: req.signal.reason }));
        return;
      }

      const globals = globalThis as unknown as Record<string, unknown>;
      const callback = options.callbackName ?? `__booze_jsonp_${Date.now().toString(36)}_${(sequence++).toString(36)}`;
      const script = doc.createElement('script');
      let timer: ReturnType<typeof setTimeout> | undefined;

      const cleanup = () => {
        clearTimeout(timer);
        req.signal?.removeEventListener('abort', onAbort);
        script.remove();
        // A response that arrives later must not fail with "callback is not a function".
        globals[callback] = () => { delete globals[callback]; };
      };

      const onAbort = () => {
        cleanup();
        reject(new BoozeError('ABORTED', 'The request was aborted.', { cause: req.signal?.reason }));
      };

      globals[callback] = (data: unknown) => {
        cleanup();
        delete globals[callback];
        resolve({ status: 200, headers: {}, data, raw: data });
      };

      script.onerror = () => {
        cleanup();
        reject(new BoozeError('NETWORK_ERROR', `Loading ${req.url} as JSONP failed.`));
      };

      req.signal?.addEventListener('abort', onAbort, { once: true });

      if (req.timeout) {
        timer = setTimeout(() => {
          cleanup();
          reject(new BoozeError('TIMEOUT', `No JSONP response within ${req.timeout}ms.`));
        }, req.timeout);
      }

      const param = options.callbackParam ?? 'callback';
      script.src = appendQuery(req.url, `${encodeURIComponent(param)}=${encodeURIComponent(callback)}`);
      script.async = true;
      (doc.head ?? doc.body)!.appendChild(script);
    });
  },
});

/** Sends the class's or method's requests as JSONP. Same as `@Adapter(jsonpAdapter(options))`. */
export const JSONP = (options?: JsonpOptions): ConfigDecorator => AdapterDecorator(jsonpAdapter(options));
