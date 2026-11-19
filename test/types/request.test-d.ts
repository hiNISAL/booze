/**
 * Return-type inference. Checked by tsc in both decorator modes (standard and legacy);
 * nothing here runs.
 *
 * The [v1 类型缺陷] cases are the ones that needed `@ts-expect-error` on the 1.x branch
 * because v1 typed the call result as the request parameters.
 */
import { describe, expectTypeOf, it } from 'vitest';
import {
  After, Before, BodyType, type BoozeRequest, type Context, type FullResult, Get, Headers, type Middleware, Post, Prefix, request, Use,
} from '../../src';
import { JSONP } from '../../src/adapters/jsonp';
import { retry } from '../../src/middleware';

interface User {
  id: number;
  name: string;
}

@Prefix('/users')
class UserApi {
  @Get('/') list(page = 1) { return request<User[]>({ query: { page } }); }
  @Get('/:id') get(id: number) { return request<User>({ path: { id } }); }
  @BodyType('form') @Post('/') create(user: Omit<User, 'id'>) { return request<User>({ body: user }); }
  @Post('/remove') remove() { return request<void>(); }
  @Get('/any') untyped() { return request(); }
  @Headers({ 'x-a': '1' }) @Get('/self') self() { return request<this>(); }
  @Get('/ping') static ping() { return request<{ ok: boolean }>(); }
  @Get('/page') page() { return request.full<User[]>(); }
  @Get('/jsonp') @JSONP() @Use(retry()) jsonp() { return request<User>(); }
}

const api = new UserApi();

describe('调用结果的类型', () => {
  it('[v1 类型缺陷] 调用结果是 Promise，await 后是 request<T> 里声明的类型', async () => {
    expectTypeOf(api.get(1)).toEqualTypeOf<BoozeRequest<User>>();
    expectTypeOf(api.get(1)).toExtend<Promise<User>>();
    expectTypeOf(api.list()).resolves.toEqualTypeOf<User[]>();
    expectTypeOf(await api.create({ name: 'n' })).toEqualTypeOf<User>();
  });

  it('[v1 类型缺陷] 不需要 as：可以直接赋给 Promise<User>，也有 .then', () => {
    const p: Promise<User> = api.get(1);
    void p;
    expectTypeOf(api.get(1).then).toBeFunction();
  });

  it('[v1 类型缺陷] 没有响应体的接口也能拿到 Promise<void>', () => {
    expectTypeOf(api.remove()).resolves.toBeVoid();
  });

  it('不写 T 时是 unknown，不是 any', () => {
    expectTypeOf(api.untyped()).resolves.toBeUnknown();
  });

  it('参数类型保留', () => {
    expectTypeOf(api.get).parameters.toEqualTypeOf<[id: number]>();
    expectTypeOf(api.list).parameters.toEqualTypeOf<[page?: number]>();
  });

  it('request.full<T>() 带上 status 和 headers', () => {
    expectTypeOf(api.page()).resolves.toEqualTypeOf<FullResult<User[]>>();
    expectTypeOf(api.page()).resolves.toHaveProperty('status').toBeNumber();
  });

  it('@JSONP 和 retry() 不影响返回值类型', () => {
    expectTypeOf(api.jsonp()).resolves.toEqualTypeOf<User>();
  });

  it('静态方法', () => {
    expectTypeOf(UserApi.ping()).resolves.toEqualTypeOf<{ ok: boolean }>();
  });
});

describe('编译期就能发现的错误', () => {
  it('[v1 类型缺陷] 方法体返回普通对象时报错', () => {
    class Wrong {
      // @ts-expect-error the method must return request()
      @Get('/x') plain(page: number) { return { page }; }
    }

    void Wrong;
  });

  it('[v1 类型缺陷] async 方法报错（async 会把 BoozeRequest 展开成普通 Promise）', () => {
    class Wrong {
      // @ts-expect-error async preparation belongs in middleware
      @Get('/x') async load() { return request<User>(); }
    }

    void Wrong;
  });

  it('[v1 类型缺陷] 可以如实声明“参数是 page，响应是 User[]”', () => {
    class Typed {
      @Get('/list') list(page: number): BoozeRequest<User[]> { return request({ query: { page } }); }
    }

    expectTypeOf(new Typed().list(1)).resolves.toEqualTypeOf<User[]>();
  });

  it('声明的返回类型和 request<T> 不一致时报错', () => {
    class Wrong {
      // @ts-expect-error BoozeRequest<string> is not BoozeRequest<User[]>
      @Get('/list') list(): BoozeRequest<User[]> { return request<string>(); }
    }

    void Wrong;
  });
});

describe('中间件', () => {
  it('ctx 的类型', () => {
    const mw: Middleware = async (ctx, next) => {
      expectTypeOf(ctx).toEqualTypeOf<Context>();
      expectTypeOf(ctx.request.headers).toEqualTypeOf<Record<string, string>>();
      expectTypeOf(ctx.result).toBeUnknown();
      await next();
    };

    @Use(mw)
    @Before((ctx) => ctx.request.method !== 'DELETE')
    @After((result) => result)
    class Api { @Get('/x') x() { return request(); } }

    void Api;
  });
});
