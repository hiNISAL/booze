/**
 * End-to-end checks against a real local HTTP server, shared by every adapter test.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Adapter, Client, createClient, Get, Head, Post, request } from '../../src';
import { startServer } from './server';

export const adapterSuite = (name: string, makeAdapter: () => Adapter, supports: { uploadProgress: boolean; timeout?: boolean }) => {
  describe(`${name} 适配器（本地 HTTP 服务）`, () => {
    let server: Awaited<ReturnType<typeof startServer>>;

    beforeAll(async () => { server = await startServer(); });
    afterAll(() => server.close());

    const http = createClient({ headers: { 'X-App': 'test' }, adapter: makeAdapter() });

    @Client(http)
    class Api {
      @Get('/users') list(page: number) { return request<{ page: number }>({ query: { page } }); }
      @Post('/users') create(name: string) { return request<{ echo: { name: string } }>({ body: { name } }); }
      @Post('/raw') raw(body: string) { return request<{ echo: string }>({ body }); }
      @Get('/empty') empty() { return request<void>(); }
      @Head('/users') head() { return request<void>(); }
      @Get('/text') text() { return request<string>(); }
      @Get('/text') textType() { return request<string>({ responseType: 'text' }); }
      @Get('/users') buffer() { return request<ArrayBuffer>({ responseType: 'arrayBuffer' }); }
      @Get('/missing') missing() { return request(); }
      @Get('/slow') slow(timeout?: number, signal?: AbortSignal) { return request({ timeout, signal }); }
      @Get('/big') download(onDownloadProgress: (e: { loaded: number }) => void) {
        return request<string>({ onDownloadProgress, responseType: 'text' });
      }
      @Post('/upload') upload(onUploadProgress: (e: { loaded: number }) => void) {
        return request({ body: 'y'.repeat(64 * 1024), onUploadProgress });
      }
      @Get('/users') full() { return request.full<{ page: number }>(); }
    }

    const api = new Api();

    beforeAll(() => { http.configure({ baseURL: server.url }); });

    it('GET：query 和 headers 发到服务端，JSON 响应被解析', async () => {
      await expect(api.list(2)).resolves.toEqual({ echo: null, page: 1 });

      expect(server.last).toMatchObject({ method: 'GET', url: '/users?page=2' });
      expect(server.last.headers['x-app']).toBe('test');
    });

    it('POST：JSON body 和 content-type', async () => {
      await expect(api.create('n')).resolves.toMatchObject({ echo: { name: 'n' } });

      expect(server.last.body).toBe('{"name":"n"}');
      expect(server.last.headers['content-type']).toBe('application/json');
    });

    it('字符串 body 原样发送', async () => {
      await expect(api.raw('a=1')).resolves.toMatchObject({ echo: 'a=1' });

      expect(server.last.body).toBe('a=1');
    });

    it('响应头转成小写键名；request.full 带上 status 和 headers', async () => {
      const result = await api.full();

      expect(result.status).toBe(200);
      expect(result.headers['x-reply']).toBe('yes');
      expect(result.data).toEqual({ echo: null, page: 1 });
    });

    it('204 和 HEAD 的结果是 undefined', async () => {
      await expect(api.empty()).resolves.toBeUndefined();
      await expect(api.head()).resolves.toBeUndefined();
    });

    it('响应不是合法 JSON 时返回原文；responseType text 直接返回文本', async () => {
      await expect(api.text()).resolves.toBe('not json');
      await expect(api.textType()).resolves.toBe('not json');
    });

    it('responseType arrayBuffer', async () => {
      const buffer = await api.buffer();

      expect(new TextDecoder().decode(buffer)).toBe('{"echo":null,"page":1}');
    });

    it('404 拒绝为 HTTP_ERROR，带上解析后的响应', async () => {
      await expect(api.missing()).rejects.toMatchObject({
        code: 'HTTP_ERROR',
        response: { status: 404, data: { message: 'missing' } },
      });
    });

    it.runIf(supports.timeout ?? true)('超时拒绝为 TIMEOUT', async () => {
      await expect(api.slow(50)).rejects.toMatchObject({ code: 'TIMEOUT' });
    });

    it('signal 取消时拒绝为 ABORTED', async () => {
      const controller = new AbortController();
      const pending = api.slow(undefined, controller.signal);

      setTimeout(() => controller.abort(), 30);

      await expect(pending).rejects.toMatchObject({ code: 'ABORTED' });
    });

    it('报告下载进度', async () => {
      const events: number[] = [];

      const text = await api.download((e) => events.push(e.loaded));

      expect(events.length).toBeGreaterThan(0);
      expect(events.at(-1)).toBe(text.length);
    });

    it.runIf(supports.uploadProgress)('报告上传进度', async () => {
      const events: number[] = [];

      await api.upload((e) => events.push(e.loaded));

      expect(events.at(-1)).toBe(64 * 1024);
    });
  });
};
