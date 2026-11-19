// @vitest-environment happy-dom
/**
 * The xhr adapter, using happy-dom's XMLHttpRequest against a real local HTTP server.
 * happy-dom implements neither xhr.timeout nor upload progress events, so those two are
 * checked with a stub XMLHttpRequest below.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { Client, createClient, Get, request } from '../../src';
import { xhrAdapter } from '../../src/adapters/xhr';
import { adapterSuite } from '../support/adapter-suite';

adapterSuite('xhr', () => xhrAdapter(), { uploadProgress: false, timeout: false });

describe('xhr 适配器的其他行为', () => {
  it('没有 XMLHttpRequest 时拒绝为 NO_ADAPTER', async () => {
    const original = globalThis.XMLHttpRequest;
    // @ts-expect-error simulate a runtime without XMLHttpRequest
    delete globalThis.XMLHttpRequest;

    try {
      @Client(createClient({ adapter: xhrAdapter() }))
      class Api { @Get('https://a.com/x') x() { return request(); } }

      await expect(new Api().x()).rejects.toMatchObject({ code: 'NO_ADAPTER' });
    } finally {
      globalThis.XMLHttpRequest = original;
    }
  });

  it('网络错误拒绝为 NETWORK_ERROR', async () => {
    @Client(createClient({ adapter: xhrAdapter() }))
    class Api { @Get('http://127.0.0.1:1/x') x() { return request(); } }

    await expect(new Api().x()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });
});

describe('xhr 适配器（替身 XMLHttpRequest）', () => {
  type Listener = (event: { loaded: number; total: number; lengthComputable: boolean }) => void;

  class StubXHR {
    static last: StubXHR;
    static behavior: (xhr: StubXHR) => void = () => {};

    readonly upload = { listeners: [] as Listener[], addEventListener: (_: string, l: Listener) => this.upload.listeners.push(l) };
    readonly sent: { method?: string; url?: string; headers: Record<string, string>; body?: unknown } = { headers: {} };
    responseType = '';
    timeout = 0;
    withCredentials = false;
    status = 0;
    response: unknown = '';
    responseText = '';
    onload?: () => void;
    onerror?: () => void;
    ontimeout?: () => void;
    onabort?: () => void;

    constructor() { StubXHR.last = this; }
    open(method: string, url: string) { Object.assign(this.sent, { method, url }); }
    setRequestHeader(key: string, value: string) { this.sent.headers[key] = value; }
    addEventListener() {}
    getAllResponseHeaders() { return 'X-A: 1\r\nSet-Cookie: a\r\nset-cookie: b\r\n'; }
    abort() { this.onabort?.(); }
    send(body: unknown) {
      this.sent.body = body;
      StubXHR.behavior(this);
    }
  }

  const original = globalThis.XMLHttpRequest;
  const install = (behavior: (xhr: StubXHR) => void) => {
    StubXHR.behavior = behavior;
    globalThis.XMLHttpRequest = StubXHR as unknown as typeof XMLHttpRequest;
  };

  afterEach(() => { globalThis.XMLHttpRequest = original; });

  @Client(createClient({ adapter: xhrAdapter({ withCredentials: true }) }))
  class Api {
    @Get('https://a.com/x') x(timeout?: number, onUploadProgress?: (e: { loaded: number; total?: number }) => void) {
      return request.full({ timeout, onUploadProgress });
    }
  }

  it('把请求映射到 XMLHttpRequest，解析响应头', async () => {
    install((xhr) => {
      xhr.status = 200;
      xhr.responseText = '{"ok":true}';
      xhr.onload?.();
    });

    await expect(new Api().x(1_000)).resolves.toEqual({
      data: { ok: true }, status: 200, headers: { 'x-a': '1', 'set-cookie': 'a, b' },
    });
    expect(StubXHR.last).toMatchObject({ timeout: 1_000, withCredentials: true, responseType: 'text' });
    expect(StubXHR.last.sent).toMatchObject({ method: 'GET', url: 'https://a.com/x', body: null });
  });

  it('xhr.timeout 触发时拒绝为 TIMEOUT', async () => {
    install((xhr) => xhr.ontimeout?.());

    await expect(new Api().x(10)).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('报告上传进度', async () => {
    const events: Array<{ loaded: number; total?: number }> = [];
    install((xhr) => {
      for (const listener of xhr.upload.listeners) {
        listener({ loaded: 5, total: 0, lengthComputable: false });
        listener({ loaded: 10, total: 10, lengthComputable: true });
      }
      xhr.status = 204;
      xhr.onload?.();
    });

    await new Api().x(undefined, (e) => events.push(e));

    expect(events).toEqual([{ loaded: 5, total: undefined }, { loaded: 10, total: 10 }]);
  });
});
