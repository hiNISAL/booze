/**
 * The same end-to-end checks against a real local HTTP server, for every adapter that can run
 * in Node: fetch (built in) and axios. The xhr adapter runs the same checks in xhr.test.ts.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client, createClient, fetchAdapter, Get, Post, request } from '../../src';
import { axiosAdapter } from '../../src/adapters/axios';
import { adapterSuite } from '../support/adapter-suite';
import { startServer } from '../support/server';

let server: Awaited<ReturnType<typeof startServer>>;

beforeAll(async () => { server = await startServer(); });
afterAll(() => server.close());

adapterSuite('fetch', () => fetchAdapter(), { uploadProgress: false });
adapterSuite('axios', () => axiosAdapter(), { uploadProgress: true });

describe('axios 适配器的其他行为', () => {
  it('[v1 缺陷 #24] 非 GET 请求的 query 也拼在 URL 上', async () => {
    @Client(createClient({ baseURL: server.url, adapter: axiosAdapter() }))
    class Api { @Post('/users') create() { return request({ body: { a: 1 }, query: { q: '2' } }); } }

    await new Api().create();

    expect(server.last).toMatchObject({ method: 'POST', url: '/users?q=2', body: '{"a":1}' });
  });

  it('可以传入自己的 axios 实例', async () => {
    const calls: unknown[] = [];
    const instance = {
      request: async (config: Record<string, unknown>) => {
        calls.push(config);
        return { status: 200, headers: { 'X-Custom': ['a', 'b'] }, data: '{"ok":true}' };
      },
    };

    @Client(createClient({ adapter: axiosAdapter(instance) }))
    class Api { @Get('https://a.com/x') x() { return request.full(); } }

    await expect(new Api().x()).resolves.toEqual({ data: { ok: true }, status: 200, headers: { 'x-custom': 'a, b' } });
    expect(calls).toHaveLength(1);
  });

  it('网络错误拒绝为 NETWORK_ERROR', async () => {
    @Client(createClient({ adapter: axiosAdapter() }))
    class Api { @Get('http://127.0.0.1:1/x') x() { return request(); } }

    await expect(new Api().x()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });
});
