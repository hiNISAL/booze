/**
 * HTTP 方法装饰器 / 参数收集 / URL 拼接 / makeBody
 *
 * 约定：`it.fails` + 标题以 [BUG] 开头 = 已知缺陷。
 * 断言写的是「正确行为」，当前实现不满足所以测试“预期失败”。
 * 修好后 vitest 会提示该用例意外通过，届时把 it.fails 改成 it。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  Delete, Get, Head, makeBody, Options, Patch, Post, Prefix, Put, regAdapter, Request,
} from '../src';
import { createRecorder } from './helpers';

const rec = createRecorder('recorder', { data: 'response' });
// 必须在类定义之前注册（见 adapter.test.ts 中的“快照”问题）
regAdapter(rec.adapter);

beforeEach(() => rec.reset());

@Prefix('https://api.test.com')
class Api {
  token = 'secret';

  @Get('/get') get() { return { a: 1 }; }
  @Post('/post') post() { return { a: 1 }; }
  @Put('/put') put() { return { a: 1 }; }
  @Delete('/delete') del() { return { a: 1 }; }
  @Patch('/patch') patch() { return { a: 1 }; }
  @Head('/head') head() { return { a: 1 }; }
  @Options('/options') options() { return { a: 1 }; }
  @Request({ method: 'POST', url: '/custom' }) custom() { return { a: 1 }; }

  @Get('/override', 'https://other.com') override() { return {}; }
  @Get('/args') args(page: number, size: number) { return { page, size }; }
  @Get('/async') async asyncSource() { return { a: await Promise.resolve(2) }; }
  @Get('/nothing') nothing() {}

  @Get('/users/:id/posts/:postId') getPath(id: unknown, postId: unknown) { return [{ page: 1 }, { id, postId }]; }
  @Post('/users/:id') postPath(id: unknown) { return [{ name: 'n' }, { id }]; }
  @Get('/users/:id') missingPlaceholder() { return [{}, {}]; }
  @Get('users/:id') noLeadingSlash(id: number) { return [{}, { id }]; }

  @Get('/me') useThis() { return { token: (this as any)?.token }; }

  @Get('/qs') queryString() { return makeBody({ query: 'a=1&b[c]=2' }); }
  @Post('/body') body(onProgress: () => void) {
    return makeBody({ params: { p: 1 }, query: { q: '2' }, placeholders: {}, onProgress });
  }
  @Get('/jsonp-name') jsonpName() { return makeBody({ jsonp: 'myCallback' }); }
  @Get('/jsonp-rnd') jsonpRandom() { return makeBody({ jsonp: true }); }
  @Get('/cancel') cancel(cancel: () => void) { return makeBody({ cancel }); }
}

const api = new Api();

describe('HTTP 方法装饰器', () => {
  it.each([
    ['get', 'GET', '/get'],
    ['post', 'POST', '/post'],
    ['put', 'PUT', '/put'],
    ['del', 'DELETE', '/delete'],
    ['patch', 'PATCH', '/patch'],
    ['head', 'HEAD', '/head'],
    ['options', 'OPTIONS', '/options'],
    ['custom', 'POST', '/custom'],
  ] as const)('%s() 发出 %s 请求', async (fn, method, url) => {
    await api[fn]();

    expect(rec.calls).toHaveLength(1);
    expect(rec.last.method).toBe(method);
    expect(rec.last.url).toBe(`https://api.test.com${url}`);
    expect(rec.last._prefix).toBe('https://api.test.com');
    expect(rec.last._url).toBe(url);
  });

  it('调用结果是适配器的返回值', async () => {
    await expect(api.get()).resolves.toEqual({ data: 'response' });
  });

  it('GET 的返回值作为 query，并生成 queryString', async () => {
    await api.get();

    expect(rec.last.query).toEqual({ a: 1 });
    expect(rec.last.queryString).toBe('a=1');
    expect(rec.last.params).toEqual({});
  });

  it.each(['post', 'put', 'del', 'patch', 'head', 'options'] as const)(
    '非 GET 方法 %s() 的返回值作为 params（body）',
    async (fn) => {
      await api[fn]();

      expect(rec.last.params).toEqual({ a: 1 });
      expect(rec.last.query).toEqual({});
    },
  );

  it('方法装饰器的第二个参数覆盖类上的 @Prefix', async () => {
    await api.override();

    expect(rec.last.url).toBe('https://other.com/override');
  });

  it('调用参数原样传给原方法', async () => {
    await api.args(2, 20);

    expect(rec.last.query).toEqual({ page: 2, size: 20 });
  });

  it('原方法可以是 async', async () => {
    await api.asyncSource();

    expect(rec.last.query).toEqual({ a: 2 });
  });

  it('原方法没有返回值时，参数为空对象', async () => {
    await api.nothing();

    expect(rec.last.query).toEqual({});
    expect(rec.last.queryString).toBe('');
  });

  it.fails('[BUG] 原方法内的 this 应指向实例（当前调用丢失 this）', async () => {
    await api.useThis();

    expect(rec.last.query).toEqual({ token: 'secret' });
  });

  it.fails('[BUG] 不应在每次请求时向控制台打印 URL 片段（fillUrl 遗留 console.log）', async () => {
    await api.get();

    expect(console.log).not.toHaveBeenCalled();
  });
});

describe('路径占位符', () => {
  it('返回数组 [参数, 占位符] 时替换 :placeholder（GET → query）', async () => {
    await api.getPath(7, 'abc');

    expect(rec.last.url).toBe('https://api.test.com/users/7/posts/abc');
    expect(rec.last.query).toEqual({ page: 1 });
  });

  it('非 GET 时数组第一项作为 params', async () => {
    await api.postPath(7);

    expect(rec.last.url).toBe('https://api.test.com/users/7');
    expect(rec.last.params).toEqual({ name: 'n' });
  });

  it('（现状）缺少占位符的值时，:id 原样留在 URL 里并照常发出请求', async () => {
    await api.missingPlaceholder();

    expect(rec.last.url).toBe('https://api.test.com/users/:id');
  });

  it.fails('[BUG] 占位符的值为 0 时也应被替换（当前用 || 判断，0 被当成缺失）', async () => {
    await api.getPath(0, 0);

    expect(rec.last.url).toBe('https://api.test.com/users/0/posts/0');
  });

  it.fails('[BUG] 前缀与路径之间应自动补 /（当前直接字符串拼接）', async () => {
    await api.noLeadingSlash(1);

    expect(rec.last.url).toBe('https://api.test.com/users/1');
  });
});

describe('makeBody', () => {
  it('query 为字符串时用 qs 解析（支持嵌套）', async () => {
    await api.queryString();

    expect(rec.last.query).toEqual({ a: '1', b: { c: '2' } });
    expect(rec.last.queryString).toBe('a=1&b%5Bc%5D=2');
  });

  it('可以同时指定 params / query / onProgress', async () => {
    const onProgress = () => {};

    await api.body(onProgress);

    expect(rec.last.params).toEqual({ p: 1 });
    expect(rec.last.query).toEqual({ q: '2' });
    expect(rec.last.onProgress).toBe(onProgress);
  });

  it('jsonp 为字符串时作为回调名', async () => {
    await api.jsonpName();

    expect(rec.last.jsonp).toBe('myCallback');
  });

  it('jsonp 为 true 时生成随机回调名', async () => {
    await api.jsonpRandom();

    expect(rec.last.jsonp).toMatch(/^__callback_[0-9a-f]+$/);
  });

  it.fails('[BUG] cancel 应原样传给适配器（当前被错误地赋值给了 onProgress）', async () => {
    const cancel = () => {};

    await api.cancel(cancel);

    expect(rec.last.cancel).toBe(cancel);
    expect(rec.last.onProgress).toBeNull();
  });
});
