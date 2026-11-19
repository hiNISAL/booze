/**
 * Decorator order. v1 silently ignored any decorator written above @Get. In v2 every
 * decorator only records config, which is read at call time, so both positions behave the same.
 * [v1 缺陷 #n] = v1 known-defect case rewritten against the v2 API.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Adapter, After, Before, BodyType, Client, Get, Headers, Post, Prefix, request, Timeout, Use } from '../../src';
import { JSONP } from '../../src/adapters/jsonp';
import { installFakeDocument } from '../support/fake-document';
import { createRecorder, recordingClient } from '../support/recorder';

const { client, recorder } = recordingClient({ baseURL: 'https://o.com' }, { data: 'original' });
const other = createRecorder('other', { data: 'other' });
const log: string[] = [];

beforeEach(() => {
  recorder.reset();
  other.reset();
  log.length = 0;
});

const body = { a: 1 };

// @Get first (the only order v1 supported)
@Client(client)
class GetFirst {
  @Get('/x') @Headers('X-A', '1') headers() { return request(); }
  @Post('/x') @BodyType('form') bodyType() { return request({ body }); }
  @Get('/x') @Before(() => false) before() { return request(); }
  @Get('/x') @After(() => 'replaced') after() { return request(); }
  @Get('/x') @Adapter(other.adapter) adapter() { return request(); }
  @Get('/x') @JSONP() jsonp() { return request(); }
  @Get('/x') @Timeout(5) timeout() { return request(); }
  @Get('/x') @Use(async (_ctx, next) => { log.push('use'); await next(); }) use() { return request(); }
}

// @Get last
@Client(client)
class GetLast {
  @Headers('X-A', '1') @Get('/x') headers() { return request(); }
  @BodyType('form') @Post('/x') bodyType() { return request({ body }); }
  @Before(() => false) @Get('/x') before() { return request(); }
  @After(() => 'replaced') @Get('/x') after() { return request(); }
  @Adapter(other.adapter) @Get('/x') adapter() { return request(); }
  @JSONP() @Get('/x') jsonp() { return request(); }
  @Timeout(5) @Get('/x') timeout() { return request(); }
  @Use(async (_ctx, next) => { log.push('use'); await next(); }) @Get('/x') use() { return request(); }
}

type Method = keyof GetFirst;

const cases: Array<{ decorator: string; id: string; method: Method; check: (call: () => Promise<unknown>) => Promise<void> }> = [
  {
    decorator: '@Headers', id: '#18', method: 'headers',
    check: async (call) => { await call(); expect(recorder.last.headers).toMatchObject({ 'x-a': '1' }); },
  },
  {
    decorator: '@BodyType', id: '#19', method: 'bodyType',
    check: async (call) => {
      await call();
      expect(recorder.last.headers['content-type']).toBe('application/x-www-form-urlencoded');
    },
  },
  {
    decorator: '@Before', id: '#21', method: 'before',
    check: async (call) => {
      await expect(call()).rejects.toMatchObject({ code: 'ABORTED' });
      expect(recorder.calls).toHaveLength(0);
    },
  },
  {
    decorator: '@After', id: '#22', method: 'after',
    check: async (call) => { await expect(call()).resolves.toBe('replaced'); },
  },
  {
    decorator: '@Adapter', id: '#23', method: 'adapter',
    check: async (call) => {
      await expect(call()).resolves.toBe('other');
      expect(other.calls).toHaveLength(1);
    },
  },
  {
    decorator: '@JSONP', id: '#20', method: 'jsonp',
    check: async (call) => {
      const doc = installFakeDocument(() => ({ data: 'via jsonp' }));
      try {
        await expect(call()).resolves.toBe('via jsonp');
        expect(doc.loaded).toHaveLength(1);
        expect(recorder.calls).toHaveLength(0);
      } finally {
        doc.restore();
      }
    },
  },
  {
    decorator: '@Timeout', id: '', method: 'timeout',
    check: async (call) => { await call(); expect(recorder.last.timeout).toBe(5); },
  },
  {
    decorator: '@Use', id: '', method: 'use',
    check: async (call) => { await call(); expect(log).toEqual(['use']); },
  },
];

describe.each(cases)('$decorator', ({ id, method, check }) => {
  it('写在 @Get 下方时生效', async () => {
    const api = new GetFirst();
    await check(() => api[method]());
  });

  it(`${id ? `[v1 缺陷 ${id}] ` : ''}写在 @Get 上方时同样生效`, async () => {
    const api = new GetLast();
    await check(() => api[method]());
  });
});

describe('类装饰器', () => {
  it('类装饰器之间的顺序不影响结果', async () => {
    @Client(client)
    @Prefix('/a')
    @Before(() => { log.push('a'); })
    class A { @Get('/x') x() { return request(); } }

    @Before(() => { log.push('b'); })
    @Prefix('/b')
    @Client(client)
    class B { @Get('/x') x() { return request(); } }

    await new A().x();
    expect(recorder.last.url).toBe('https://o.com/a/x');
    await new B().x();
    expect(recorder.last.url).toBe('https://o.com/b/x');
    expect(log).toEqual(['a', 'b']);
  });
});
