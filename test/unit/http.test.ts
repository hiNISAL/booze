/**
 * HTTP method decorators, URL building, path parameters, the original method's `this` and
 * return value.
 *
 * Titles starting with [v1 缺陷 #n] are the v1 known-defect cases (it.fails on the 1.x
 * branch), rewritten against the v2 API. They must pass.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BoozeError, Client, Delete, Get, Head, Options, Patch, Post, Prefix, Put, Request, request,
} from '../../src';
import { recordingClient } from '../support/recorder';

const { client, recorder } = recordingClient({ baseURL: 'https://api.test.com' }, { data: 'response' });

beforeEach(() => recorder.reset());

@Client(client)
@Prefix('/v1')
class Api {
  token = 'secret';

  @Get('/get') get() { return request<string>(); }
  @Post('/post') post() { return request(); }
  @Put('/put') put() { return request(); }
  @Delete('/delete') del() { return request(); }
  @Patch('/patch') patch() { return request(); }
  @Head('/head') head() { return request(); }
  @Options('/options') options() { return request(); }
  @Request('report', '/custom') custom() { return request(); }

  @Get('https://other.com/abs') absolute() { return request(); }
  @Get() root() { return request(); }
  @Get('users/:id') noLeadingSlash(id: number) { return request({ path: { id } }); }
  @Get('/users/:id/posts/:postId') getPath(id: unknown, postId: unknown) {
    return request({ path: { id: id as number, postId: postId as number } });
  }
  @Get('/users/:id') missingPath() { return request({ path: {} }); }
  @Get('/search') search(q: string, tags: string[]) { return request({ query: { q, tags, empty: undefined } }); }
  @Post('/users') create(name: string) { return request({ body: { name }, query: { notify: true } }); }
  @Get('/me') useThis() { return request({ query: { token: this.token } }); }
  @Get('/cancel') cancellable(signal: AbortSignal) { return request({ signal }); }
  @Get('/call-headers') callHeaders() { return request({ headers: { 'X-Call': '1' }, timeout: 50 }); }

  @Get('/ping') static ping() { return request<{ ok: boolean }>(); }
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
    ['custom', 'REPORT', '/custom'],
  ] as const)('%s() 发出 %s 请求', async (name, method, path) => {
    await api[name]();

    expect(recorder.calls).toHaveLength(1);
    expect(recorder.last.method).toBe(method);
    expect(recorder.last.url).toBe(`https://api.test.com/v1${path}`);
  });

  it('调用结果是响应的 data', async () => {
    await expect(api.get()).resolves.toBe('response');
  });

  it('静态方法同样可以装饰，不需要实例化', async () => {
    await Api.ping();

    expect(recorder.last.url).toBe('https://api.test.com/v1/ping');
  });

  it('同一个方法有两个 HTTP 方法装饰器时，定义类时就报错', () => {
    expect(() => {
      class Twice {
        @Get('/a') @Post('/b') x() { return request(); }
      }

      return Twice;
    }).toThrow(/two HTTP method decorators/);
  });

  it('[v1 缺陷 #1] 原方法里的 this 指向实例', async () => {
    await api.useThis();

    expect(recorder.last.url).toBe('https://api.test.com/v1/me?token=secret');
  });

  it('[v1 缺陷 #2] 请求时不向控制台打印任何内容', async () => {
    const log = vi.spyOn(console, 'log');

    await api.get();

    expect(log).not.toHaveBeenCalled();
  });
});

describe('URL 拼接', () => {
  it('绝对 URL 跳过 baseURL 和 @Prefix（取代 v1 @Get 的第二个参数）', async () => {
    await api.absolute();

    expect(recorder.last.url).toBe('https://other.com/abs');
  });

  it('@Get() 不写路径时请求 @Prefix 本身', async () => {
    await api.root();

    expect(recorder.last.url).toBe('https://api.test.com/v1');
  });

  it('[v1 缺陷 #4] 前缀与路径之间自动补 /', async () => {
    await api.noLeadingSlash(1);

    expect(recorder.last.url).toBe('https://api.test.com/v1/users/1');
  });
});

describe('路径参数', () => {
  it('替换 :name，值经过 encodeURIComponent', async () => {
    await api.getPath(7, 'a b/c');

    expect(recorder.last.url).toBe('https://api.test.com/v1/users/7/posts/a%20b%2Fc');
  });

  it('[v1 缺陷 #3] 值为 0 时也会替换', async () => {
    await api.getPath(0, 0);

    expect(recorder.last.url).toBe('https://api.test.com/v1/users/0/posts/0');
  });

  it('缺少值时拒绝并给出 MISSING_PATH_PARAM，不发请求（v1 会把 :id 原样发出去）', async () => {
    await expect(api.missingPath()).rejects.toMatchObject({ code: 'MISSING_PATH_PARAM' });
    expect(recorder.calls).toHaveLength(0);
  });
});

describe('request() 的参数', () => {
  it('query 拼到 URL 上：数组重复键名，undefined 被忽略', async () => {
    await api.search('booze', ['a', 'b']);

    expect(recorder.last.url).toBe('https://api.test.com/v1/search?q=booze&tags=a&tags=b');
  });

  it('[v1 缺陷 #24] 非 GET 请求的 query 同样拼到 URL 上', async () => {
    await api.create('n');

    expect(recorder.last.method).toBe('POST');
    expect(recorder.last.url).toBe('https://api.test.com/v1/users?notify=true');
    expect(recorder.last.body).toBe('{"name":"n"}');
  });

  it('[v1 缺陷 #5] signal 原样传给适配器（取代 v1 的 cancel）', async () => {
    const controller = new AbortController();

    await api.cancellable(controller.signal);

    expect(recorder.last.signal).toBe(controller.signal);
  });

  it('signal 已经取消时直接拒绝为 ABORTED，不发请求', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(api.cancellable(controller.signal)).rejects.toMatchObject({ code: 'ABORTED' });
    expect(recorder.calls).toHaveLength(0);
  });

  it('单次调用的 headers 和 timeout 传给适配器', async () => {
    await api.callHeaders();

    expect(recorder.last.headers).toEqual({ 'x-call': '1' });
    expect(recorder.last.timeout).toBe(50);
  });
});

describe('方法体的返回值', () => {
  it('返回的不是 request() 时拒绝为 INVALID_RETURN（JS 用户的兜底，TS 在编译期就报错）', async () => {
    class Wrong {
      // @ts-expect-error 编译期就会报错
      @Get('/x') plain() { return { a: 1 }; }
      // @ts-expect-error 编译期就会报错
      @Get('/x') async asyncMethod() { return request(); }
    }

    await expect(new Wrong().plain()).rejects.toMatchObject({ code: 'INVALID_RETURN' });
    await expect(new Wrong().asyncMethod()).rejects.toMatchObject({ code: 'INVALID_RETURN' });
    expect(recorder.calls).toHaveLength(0);
  });

  it('原方法抛错时，调用被拒绝为同一个错误', async () => {
    class Throws {
      @Get('/x') x(): ReturnType<typeof request> { throw new RangeError('bad input'); }
    }

    await expect(new Throws().x()).rejects.toThrow(RangeError);
  });

  it('忘了加装饰器、直接 await request() 时拒绝为 NOT_DECORATED', async () => {
    class Undecorated {
      x() { return request<string>(); }
    }

    const error = await new Undecorated().x().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BoozeError);
    expect(error).toMatchObject({ code: 'NOT_DECORATED' });
  });
});
