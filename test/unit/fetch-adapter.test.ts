/** fetch adapter paths that need a stub fetch. The HTTP behavior is in adapters-e2e.test.ts. */
import { describe, expect, it } from 'vitest';
import { Client, createClient, fetchAdapter, Get, request } from '../../src';

describe('fetch 适配器（替身 fetch）', () => {
  it('fetch 本身抛错时拒绝为 NETWORK_ERROR', async () => {
    @Client(createClient({ adapter: fetchAdapter({ fetch: () => Promise.reject(new TypeError('fetch failed')) }) }))
    class Api { @Get('https://a.com/x') x() { return request(); } }

    await expect(new Api().x()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });

  it('init 里的额外选项传给 fetch', async () => {
    let seen: RequestInit | undefined;
    const fetch = async (_url: unknown, init?: RequestInit) => {
      seen = init;
      return new Response('{}', { status: 200 });
    };

    @Client(createClient({ adapter: fetchAdapter({ fetch, init: { credentials: 'include' } }) }))
    class Api { @Get('https://a.com/x') x() { return request(); } }

    await new Api().x();

    expect(seen).toMatchObject({ credentials: 'include', method: 'GET' });
  });

  it('没有可用的 fetch 时拒绝为 NO_ADAPTER', async () => {
    const original = globalThis.fetch;
    // @ts-expect-error simulate a runtime without fetch
    delete globalThis.fetch;

    try {
      @Client(createClient())
      class NoFetch { @Get('https://a.com/x') x() { return request(); } }

      await expect(new NoFetch().x()).rejects.toMatchObject({ code: 'NO_ADAPTER' });
    } finally {
      globalThis.fetch = original;
    }
  });
});
