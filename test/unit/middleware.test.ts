/**
 * Middleware (client.use, @Use) and the @Before / @After shorthands. They replace v1's
 * @Before, @After, @BeforeExecSourceFn, eachAfter and eachBeforeExecSourceFn.
 * [v1 缺陷 #n] = v1 known-defect case rewritten against the v2 API.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import * as booze from '../../src';
import { After, Before, Client, Get, request, Use, type Middleware } from '../../src';
import { recordingClient } from '../support/recorder';

const log: string[] = [];

const { client, recorder } = recordingClient({ baseURL: 'https://m.com' }, () => {
  log.push('adapter');
  return { data: { value: 1 } };
});

const trace = (name: string): Middleware => async (_ctx, next) => {
  log.push(`${name}:in`);
  await next();
  log.push(`${name}:out`);
};

client.use(trace('client'));

beforeEach(() => {
  recorder.reset();
  log.length = 0;
});

@Client(client)
@Use(trace('class-upper'))
@Before(() => { log.push('class-before'); })
@After(() => { log.push('class-after'); })
@Use(trace('class-lower'))
class Api {
  @Get('/order')
  @Use(trace('method'))
  @Before(() => { log.push('method-before'); })
  @After(() => { log.push('method-after'); })
  order() { log.push('source'); return request(); }

  @Get('/ctx') @Before((ctx) => { log.push(`before:${ctx.request.method} ${ctx.request.url}`); })
  withCtx() { return request(); }

  @Get('/abort') @Before(() => false) abort() { return request(); }
  @Get('/abort-async') @Before(async () => false) abortAsync() { return request(); }

  @Get('/replace') @After((result, ctx) => ({ replaced: result, url: ctx.request.url })) replace() { return request(); }
  @Get('/keep') @After(() => undefined) keep() { return request(); }
  @Get('/falsy') @After(() => 0) falsy() { return request<number>(); }

  @Get('/plain') plain() { return request(); }
  @Get('/counted') @Use(async (_ctx, next) => { log.push('method-mw'); await next(); }) counted() { return request(); }
}

let receivedByMethodAfter: unknown;

@Client(client)
@After(async (result) => ({ ...(result as object), classAsync: true }))
class AsyncAfterApi {
  @Get('/x') @After((result) => { receivedByMethodAfter = result; }) x() { return request(); }
}

@Client(client)
@Use(async (_ctx, next) => { log.push('class-mw'); await next(); })
class ClassUseApi {
  @Get('/a') a() { return request(); }
  @Get('/b') b() { return request(); }
}

const api = new Api();

describe('执行顺序', () => {
  it('客户端 → 类 → 方法从外到内包裹请求；同一层写在上方的在外层', async () => {
    await api.order();

    expect(log).toEqual([
      'source',
      'client:in',
      'class-upper:in', 'class-before', 'class-lower:in',
      'method:in', 'method-before',
      'adapter',
      'method-after', 'method:out',
      'class-lower:out', 'class-after', 'class-upper:out',
      'client:out',
    ]);
  });

  it('中间件拿到完整的 ctx', async () => {
    await api.withCtx();

    expect(log).toContain('before:GET https://m.com/ctx');
  });
});

describe('@Before', () => {
  it('返回 false 时拒绝为 ABORTED，不发请求（v1 是静默 resolve undefined）', async () => {
    await expect(api.abort()).rejects.toMatchObject({ code: 'ABORTED' });
    expect(recorder.calls).toHaveLength(0);
  });

  it('async 返回 false 同样中断', async () => {
    await expect(api.abortAsync()).rejects.toMatchObject({ code: 'ABORTED' });
    expect(recorder.calls).toHaveLength(0);
  });
});

describe('@After', () => {
  it('返回值替换结果，并能拿到 ctx', async () => {
    await expect(api.replace()).resolves.toEqual({ replaced: { value: 1 }, url: 'https://m.com/replace' });
  });

  it('返回 undefined 时保留原结果', async () => {
    await expect(api.keep()).resolves.toEqual({ value: 1 });
  });

  it('[v1 缺陷 #8] 返回 0 / "" / false 也会替换结果', async () => {
    await expect(api.falsy()).resolves.toBe(0);
  });

  it('[v1 缺陷 #9] async 的 After 会被 await，下一层拿到的是结果而不是 Promise', async () => {
    await new AsyncAfterApi().x();

    // method-level After runs inside class-level After, so it sees the raw result first.
    expect(receivedByMethodAfter).toEqual({ value: 1 });
    await expect(new AsyncAfterApi().x()).resolves.toEqual({ value: 1, classAsync: true });
  });
});

describe('client.use()（取代 eachAfter / eachBeforeExecSourceFn）', () => {
  it('可以注册多个，先注册的在外层', async () => {
    const { client: c, recorder: r } = recordingClient({}, { data: 1 });
    c.use(async (ctx, next) => { await next(); ctx.result = `${String(ctx.result)}-outer`; });
    c.use(async (ctx, next) => { await next(); ctx.result = `${String(ctx.result)}-inner`; });

    @Client(c)
    class Local { @Get('/x') x() { return request<string>(); } }

    await expect(new Local().x()).resolves.toBe('1-inner-outer');
    expect(r.calls).toHaveLength(1);
  });

  it('不调用 next() 但设置了 ctx.result 时，直接返回它（缓存、mock）', async () => {
    const { client: c, recorder: r } = recordingClient();
    c.use((ctx) => { ctx.result = 'from-cache'; });

    @Client(c)
    class Local { @Get('/x') x() { return request<string>(); } }

    await expect(new Local().x()).resolves.toBe('from-cache');
    expect(r.calls).toHaveLength(0);
  });

  it('不调用 next() 也没设置结果时拒绝为 ABORTED', async () => {
    const { client: c } = recordingClient();
    c.use(() => {});

    @Client(c)
    class Local { @Get('/x') x() { return request(); } }

    await expect(new Local().x()).rejects.toMatchObject({ code: 'ABORTED' });
  });

  it('next() 可以多次调用，用于重试', async () => {
    let attempts = 0;
    const { client: c, recorder: r } = recordingClient({}, () => {
      attempts += 1;
      return attempts < 3 ? { status: 503 } : { data: 'ok' };
    });
    c.use(async (_ctx, next) => {
      for (let i = 0; ; i++) {
        try {
          return await next();
        } catch (error) {
          if (i === 2) throw error;
        }
      }
    });

    @Client(c)
    class Local { @Get('/x') x() { return request<string>(); } }

    await expect(new Local().x()).resolves.toBe('ok');
    expect(r.calls).toHaveLength(3);
  });

  it('中间件抛出的错误原样传给调用方', async () => {
    const { client: c } = recordingClient();
    c.use(() => { throw new RangeError('nope'); });

    @Client(c)
    class Local { @Get('/x') x() { return request(); } }

    await expect(new Local().x()).rejects.toThrow(RangeError);
  });
});

describe('@Use（取代 @BeforeExecSourceFn）', () => {
  it('[v1 缺陷 #10] 从包入口导出', () => {
    expect(booze).toHaveProperty('Use');
    expect(booze).toHaveProperty('Before');
    expect(booze).toHaveProperty('After');
  });

  it('[v1 缺陷 #11] 方法上的 @Use 不依赖客户端中间件也能正常工作', async () => {
    const { client: bare, recorder: r } = recordingClient({}, { data: 'ok' });

    @Client(bare)
    class Local {
      @Get('/x') @Use(async (_ctx, next) => { log.push('only-method'); await next(); }) x() { return request(); }
    }

    await expect(new Local().x()).resolves.toBe('ok');
    expect(log).toEqual(['only-method']);
    expect(r.calls).toHaveLength(1);
  });

  it('[v1 缺陷 #12] 方法上的中间件每次调用只执行一次', async () => {
    await api.counted();

    expect(log.filter((entry) => entry === 'method-mw')).toHaveLength(1);
  });

  it('[v1 缺陷 #13] 类上的 @Use 对所有方法生效', async () => {
    const classApi = new ClassUseApi();

    await classApi.a();
    await classApi.b();

    expect(log.filter((entry) => entry === 'class-mw')).toHaveLength(2);
  });

  it('@Use(a, b)：a 在 b 外层', async () => {
    @Client(client)
    class Local {
      @Get('/x') @Use(trace('a'), trace('b')) x() { return request(); }
    }

    await new Local().x();

    expect(log.filter((entry) => /^[ab]:/.test(entry))).toEqual(['a:in', 'b:in', 'b:out', 'a:out']);
  });
});
