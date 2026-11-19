/** request.full<T>() and the retry() middleware. */
import { beforeEach, describe, expect, it } from 'vitest';
import { Client, Get, Post, request, Use } from '../../src';
import { retry } from '../../src/middleware';
import type { AdapterRequest, BoozeResponse } from '../../src';
import { recordingClient } from '../support/recorder';

describe('request.full<T>()', () => {
  const { client, recorder } = recordingClient({ baseURL: 'https://f.com' }, {
    status: 201, headers: { 'x-total': '3' }, data: { code: 0, data: [1, 2, 3] },
  });
  client.use(async (ctx, next) => {
    await next();
    ctx.result = (ctx.result as { data: unknown }).data;
  });

  @Client(client)
  class Api {
    @Get('/items') items() { return request.full<number[]>(); }
    @Get('/items') plain() { return request<number[]>(); }
  }

  beforeEach(() => recorder.reset());

  it('返回 { data, status, headers }，data 是经过中间件之后的结果', async () => {
    await expect(new Api().items()).resolves.toEqual({ data: [1, 2, 3], status: 201, headers: { 'x-total': '3' } });
  });

  it('普通的 request<T>() 不受影响', async () => {
    await expect(new Api().plain()).resolves.toEqual([1, 2, 3]);
  });

  it('中间件没发请求就给出结果时，status 为 200、headers 为空', async () => {
    const { client: cached } = recordingClient();
    cached.use((ctx) => { ctx.result = 'cached'; });

    @Client(cached)
    class Cached { @Get('https://f.com/x') x() { return request.full<string>(); } }

    await expect(new Cached().x()).resolves.toEqual({ data: 'cached', status: 200, headers: {} });
  });
});

describe('retry()', () => {
  type Step = Partial<BoozeResponse> | Error;

  const flaky = (steps: Step[], options: Parameters<typeof retry>[0] = {}) => {
    let index = 0;
    const { client, recorder } = recordingClient({ baseURL: 'https://r.com' }, (req: AdapterRequest) => {
      void req;
      const step = steps[Math.min(index++, steps.length - 1)]!;
      if (step instanceof Error) throw step;
      return step;
    });
    client.use(retry({ delay: 0, ...options }));

    @Client(client)
    class Api {
      @Get('/x') get(signal?: AbortSignal) { return request<string>({ signal }); }
      @Post('/x') post() { return request<string>(); }
    }

    return { api: new Api(), recorder };
  };

  it('5xx 后重试，成功即返回', async () => {
    const { api, recorder } = flaky([{ status: 503 }, { status: 502 }, { data: 'ok' }]);

    await expect(api.get()).resolves.toBe('ok');
    expect(recorder.calls).toHaveLength(3);
  });

  it('网络错误也会重试', async () => {
    const { api, recorder } = flaky([new Error('socket hang up'), { data: 'ok' }]);

    await expect(api.get()).resolves.toBe('ok');
    expect(recorder.calls).toHaveLength(2);
  });

  it('超过次数后抛出最后一次的错误', async () => {
    const { api, recorder } = flaky([{ status: 500 }], { retries: 2 });

    await expect(api.get()).rejects.toMatchObject({ code: 'HTTP_ERROR', response: { status: 500 } });
    expect(recorder.calls).toHaveLength(3);
  });

  it('默认不重试 POST（非幂等）', async () => {
    const { api, recorder } = flaky([{ status: 503 }, { data: 'ok' }]);

    await expect(api.post()).rejects.toMatchObject({ code: 'HTTP_ERROR' });
    expect(recorder.calls).toHaveLength(1);
  });

  it('默认不重试 4xx', async () => {
    const { api, recorder } = flaky([{ status: 404 }, { data: 'ok' }]);

    await expect(api.get()).rejects.toMatchObject({ response: { status: 404 } });
    expect(recorder.calls).toHaveLength(1);
  });

  it('when 可以替换默认判断', async () => {
    const { api, recorder } = flaky([{ status: 503 }, { data: 'ok' }], { when: () => true });

    await expect(api.post()).resolves.toBe('ok');
    expect(recorder.calls).toHaveLength(2);
  });

  it('按 delay 函数等待，Retry-After 响应头优先', async () => {
    const waits: number[] = [];
    const { api } = flaky(
      [{ status: 503 }, { status: 429, headers: { 'retry-after': '0' } }, { data: 'ok' }],
      { delay: (attempt) => { waits.push(attempt); return 1; } },
    );

    await expect(api.get()).resolves.toBe('ok');
    expect(waits).toEqual([1]);
  });

  it('等待期间取消，拒绝为 ABORTED', async () => {
    const { api, recorder } = flaky([{ status: 503 }, { data: 'ok' }], { delay: 1_000 });
    const controller = new AbortController();
    const pending = api.get(controller.signal);

    setTimeout(() => controller.abort(), 10);

    await expect(pending).rejects.toMatchObject({ code: 'ABORTED' });
    expect(recorder.calls).toHaveLength(1);
  });

  it('可以只用在一个方法上', async () => {
    let calls = 0;
    const { client } = recordingClient({}, () => (++calls < 2 ? { status: 500 } : { data: 'ok' }));

    @Client(client)
    class Api { @Get('https://r.com/x') @Use(retry({ delay: 0 })) x() { return request<string>(); } }

    await expect(new Api().x()).resolves.toBe('ok');
  });
});
