/**
 * 钩子：@Before / @After / @BeforeExecSourceFn / eachAfter / eachBeforeExecSourceFn
 * 约定同 http-methods.test.ts：it.fails + [BUG] = 已知缺陷。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import * as booze from '../src';
import {
  After, Before, eachAfter, eachBeforeExecSourceFn, Get, Prefix, regAdapter,
} from '../src';
// 未从 src/index.ts 导出，只能从内部路径引入
import BeforeExecSourceFn from '../src/decorators/BeforeExecSourceFn';
import { createRecorder } from './helpers';

const rec = createRecorder('recorder', { data: 1 });
regAdapter(rec.adapter);

const log: string[] = [];

beforeEach(() => {
  rec.reset();
  log.length = 0;
  eachAfter(null);
  eachBeforeExecSourceFn(null);
});

@Prefix('https://hook.com')
@Before(() => { log.push('class-before'); })
@After(() => { log.push('class-after'); })
class Api {
  @Get('/order')
  @Before(() => { log.push('method-before'); })
  @After(() => { log.push('method-after'); })
  order() { log.push('source'); return {}; }

  @Get('/config') @Before((config) => { log.push(`before:${config.url}?${config.queryString}`); })
  config() { return { a: 1 }; }

  @Get('/abort') @Before(() => false) abort() { return {}; }
  @Get('/abort-async') @Before(async () => false) abortAsync() { return {}; }

  @Get('/replace') @After((r: any, config) => ({ replaced: r, url: config.url })) replace() { return {}; }
  @Get('/keep') @After(() => undefined) keep() { return {}; }
  @Get('/falsy') @After(() => 0) falsy() { return {}; }

  @Get('/args') args(page: number) { log.push('source'); return { page }; }

  @Get('/method-exec') @BeforeExecSourceFn(() => { log.push('method-exec'); }) methodExec() { return {}; }
}

let receivedByMethodAfter: unknown;

@Prefix('https://hook.com')
@After(async (r: any) => ({ ...r, classAsync: true }))
class AsyncAfterApi {
  @Get('/x') @After((r) => { receivedByMethodAfter = r; }) x() { return {}; }
}

@Prefix('https://hook.com')
@BeforeExecSourceFn(() => { log.push('class-exec'); })
class ClassExecApi {
  @Get('/x') x() { return {}; }
}

const api = new Api();

describe('@Before', () => {
  it('执行顺序：原方法 → 类 Before → 方法 Before → 适配器 → 类 After → 方法 After', async () => {
    await api.order();

    expect(log).toEqual(['source', 'class-before', 'method-before', 'class-after', 'method-after']);
  });

  it('接收组装好的请求配置', async () => {
    await api.config();

    expect(log).toContain('before:https://hook.com/config?a=1');
  });

  it('返回 false 时中断请求，调用结果为 undefined', async () => {
    await expect(api.abort()).resolves.toBeUndefined();
    expect(rec.calls).toHaveLength(0);
  });

  it('async 返回 false 同样中断', async () => {
    await expect(api.abortAsync()).resolves.toBeUndefined();
    expect(rec.calls).toHaveLength(0);
  });
});

describe('@After', () => {
  it('返回值替换响应，并能拿到请求配置', async () => {
    await expect(api.replace()).resolves.toEqual({ replaced: { data: 1 }, url: 'https://hook.com/replace' });
  });

  it('返回 undefined 时保留原响应', async () => {
    await expect(api.keep()).resolves.toEqual({ data: 1 });
  });

  it('全局 eachAfter → 类 After → 方法 After 依次以“漏斗”方式传递响应', async () => {
    eachAfter((r: any) => ({ ...r, global: true }));

    await expect(api.replace()).resolves.toEqual({
      replaced: { data: 1, global: true },
      url: 'https://hook.com/replace',
    });
  });

  it.fails('[BUG] After 返回 0 / "" / false 也应替换响应（当前用真值判断，被忽略）', async () => {
    await expect(api.falsy()).resolves.toBe(0);
  });

  it.fails('[BUG] async After 的结果应先 await 再传给下一个 After（当前传下去的是 Promise）', async () => {
    await new AsyncAfterApi().x();

    expect(receivedByMethodAfter).toEqual({ data: 1, classAsync: true });
  });
});

describe('eachBeforeExecSourceFn（全局）', () => {
  it('在原方法执行前触发，拿到 url / method / prefix / args', async () => {
    let base: unknown;
    eachBeforeExecSourceFn((b) => { base = b; log.push('global-exec'); });

    await api.args(3);

    expect(log.slice(0, 2)).toEqual(['global-exec', 'source']);
    expect(base).toEqual({ url: '/args', method: 'GET', prefix: 'https://hook.com', args: [3] });
  });

  it('返回 false 时中断：原方法不执行、不发请求', async () => {
    eachBeforeExecSourceFn(() => false);

    await expect(api.args(1)).resolves.toBeUndefined();
    expect(log).not.toContain('source');
    expect(rec.calls).toHaveLength(0);
  });
});

describe('@BeforeExecSourceFn', () => {
  it.fails('[BUG] 应从包入口导出（readme 有文档，但 src/index.ts 没导出）', () => {
    expect(booze).toHaveProperty('BeforeExecSourceFn');
  });

  it.fails('[BUG] 未注册全局 eachBeforeExecSourceFn 时，方法级 BeforeExecSourceFn 不应抛错', async () => {
    await expect(api.methodExec()).resolves.toEqual({ data: 1 });
  });

  it.fails('[BUG] 方法级 BeforeExecSourceFn 只应执行一次（当前执行两次）', async () => {
    eachBeforeExecSourceFn(() => {});

    await api.methodExec();

    expect(log.filter((x) => x === 'method-exec')).toHaveLength(1);
  });

  it.fails('[BUG] 类上的 BeforeExecSourceFn 应对所有方法生效（当前从未执行）', async () => {
    eachBeforeExecSourceFn(() => {});

    await new ClassExecApi().x();

    expect(log).toContain('class-exec');
  });
});
