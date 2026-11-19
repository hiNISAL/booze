/**
 * The jsonp adapter and @JSONP, with a fake `document`.
 * [v1 缺陷 #25] v1's axios adapter only used JSONP for method "JSONP", which booze never produced.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { Client, createClient, Get, Post, Prefix, request } from '../../src';
import { JSONP, jsonpAdapter } from '../../src/adapters/jsonp';
import { installFakeDocument, type ScriptReply } from '../support/fake-document';
import { createRecorder } from '../support/recorder';

let fake: ReturnType<typeof installFakeDocument> | undefined;

const install = (reply?: (url: URL) => ScriptReply) => {
  fake = installFakeDocument(reply);
  return fake;
};

afterEach(() => {
  fake?.restore();
  fake = undefined;
});

const other = createRecorder('other');

@Client(createClient({ baseURL: 'https://j.com', adapter: other.adapter }))
@Prefix('/api')
class Api {
  @Get('/user') @JSONP() user(id: number) { return request<{ ok: boolean }>({ query: { id } }); }
  @Get('/named') @JSONP({ callbackParam: 'cb', callbackName: 'handle' }) named() { return request(); }
  @Get('/slow') @JSONP() slow(timeout?: number, signal?: AbortSignal) { return request({ timeout, signal }); }
  @Post('/post') @JSONP() post() { return request(); }
  @Get('/normal') normal() { return request(); }
}

const api = new Api();

describe('jsonp 适配器', () => {
  it('[v1 缺陷 #25] @JSONP() 让请求走 JSONP：callback 参数拼进 URL，结果是回调收到的数据', async () => {
    const { loaded } = install(() => ({ data: { ok: true } }));

    await expect(api.user(7)).resolves.toEqual({ ok: true });

    expect(loaded).toHaveLength(1);
    expect(loaded[0]!.origin + loaded[0]!.pathname).toBe('https://j.com/api/user');
    expect(loaded[0]!.searchParams.get('id')).toBe('7');
    expect(loaded[0]!.searchParams.get('callback')).toMatch(/^__booze_jsonp_/);
  });

  it('请求结束后移除 script 和全局回调', async () => {
    const doc = install();

    await api.user(1);

    const callback = doc.loaded[0]!.searchParams.get('callback')!;
    expect(doc.attached).toBe(0);
    expect(globalThis).not.toHaveProperty(callback);
  });

  it('可以指定 callback 参数名和固定的回调名', async () => {
    const { loaded } = install();

    await api.named();

    expect(loaded[0]!.searchParams.get('cb')).toBe('handle');
  });

  it('没有 @JSONP 的方法仍然用客户端的适配器', async () => {
    install();

    await api.normal();

    expect(other.last.url).toBe('https://j.com/api/normal');
  });

  it('script 加载失败时拒绝为 NETWORK_ERROR', async () => {
    install(() => 'error');

    await expect(api.user(1)).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });

  it('超时拒绝为 TIMEOUT，之后迟到的响应不会报错', async () => {
    const doc = install(() => 'hang');

    await expect(api.slow(20)).rejects.toMatchObject({ code: 'TIMEOUT' });

    const late = (globalThis as unknown as Record<string, () => void>)[doc.loaded[0]!.searchParams.get('callback')!];
    expect(late).toBeTypeOf('function');
    expect(() => late!()).not.toThrow();
  });

  it('signal 取消时拒绝为 ABORTED', async () => {
    install(() => 'hang');
    const controller = new AbortController();
    const pending = api.slow(undefined, controller.signal);

    setTimeout(() => controller.abort(), 10);

    await expect(pending).rejects.toMatchObject({ code: 'ABORTED' });
  });

  it('只支持 GET', async () => {
    install();

    await expect(api.post()).rejects.toThrow(/only supports GET/);
  });

  it('没有 document 时拒绝为 NO_ADAPTER', async () => {
    @Client(createClient({ adapter: jsonpAdapter() }))
    class NoDocument { @Get('https://j.com/x') x() { return request(); } }

    await expect(new NoDocument().x()).rejects.toMatchObject({ code: 'NO_ADAPTER' });
  });
});
