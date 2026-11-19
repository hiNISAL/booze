/**
 * Clients and adapters. Replaces v1's regAdapter / setAdapter / @Adapter('name') and the
 * module-level adapter singleton.
 * [v1 缺陷 #n] = v1 known-defect case rewritten against the v2 API.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { Adapter, Client, configure, createClient, defaultClient, Get, Prefix, request, Timeout } from '../../src';
import { createRecorder, recordingClient } from '../support/recorder';

const originalDefaults = { ...defaultClient.options };

afterEach(() => {
  for (const key of Object.keys(defaultClient.options)) delete defaultClient.options[key as keyof typeof originalDefaults];
  Object.assign(defaultClient.options, originalDefaults);
});

describe('客户端', () => {
  it('没有 @Client 的类使用默认客户端，用 configure() 配置', async () => {
    const recorder = createRecorder();
    configure({ baseURL: 'https://default.com', adapter: recorder.adapter });

    class Api { @Get('/x') x() { return request(); } }

    await new Api().x();

    expect(recorder.last.url).toBe('https://default.com/x');
  });

  it('[v1 缺陷 #14] 类定义之后再切换适配器，下一次调用就生效', async () => {
    const a = createRecorder('A');
    const b = createRecorder('B');
    configure({ baseURL: 'https://a.com', adapter: a.adapter });

    class Api { @Get('/x') x() { return request(); } }

    await new Api().x();
    configure({ adapter: b.adapter });
    await new Api().x();

    expect(a.calls).toHaveLength(1);
    expect(b.calls).toHaveLength(1);
  });

  it('[v1 缺陷 #15] 多个客户端各自保留自己的适配器和配置，互不覆盖', async () => {
    const one = recordingClient({ baseURL: 'https://one.com' });
    const two = recordingClient({ baseURL: 'https://two.com' });

    @Client(one.client) class One { @Get('/x') x() { return request(); } }
    @Client(two.client) class Two { @Get('/x') x() { return request(); } }

    await new One().x();
    await new Two().x();

    expect(one.recorder.calls.map((c) => c.url)).toEqual(['https://one.com/x']);
    expect(two.recorder.calls.map((c) => c.url)).toEqual(['https://two.com/x']);
  });

  it('configure() 合并 headers，其他选项直接替换', () => {
    const client = createClient({ baseURL: 'https://a.com', headers: { 'x-a': '1' } });

    client.configure({ baseURL: 'https://b.com', headers: { 'x-b': '2' } });

    expect(client.options).toMatchObject({ baseURL: 'https://b.com', headers: { 'x-a': '1', 'x-b': '2' } });
  });

  it('子类的 @Client 覆盖父类的', async () => {
    const parent = recordingClient({ baseURL: 'https://parent.com' });
    const child = recordingClient({ baseURL: 'https://child.com' });

    @Client(parent.client) class Base { @Get('/x') x() { return request(); } }
    @Client(child.client) class Derived extends Base {}

    await new Derived().x();
    await new Base().x();

    expect(child.recorder.last.url).toBe('https://child.com/x');
    expect(parent.recorder.last.url).toBe('https://parent.com/x');
  });

  it('非 2xx 时拒绝为 HTTP_ERROR，并带上响应', async () => {
    const { client } = recordingClient({}, { status: 404, data: { message: 'missing' } });

    @Client(client) class Api { @Get('https://a.com/x') x() { return request(); } }

    await expect(new Api().x()).rejects.toMatchObject({
      code: 'HTTP_ERROR',
      response: { status: 404, data: { message: 'missing' } },
    });
  });

  it('validateStatus 可以修改成功的范围', async () => {
    const { client } = recordingClient({ validateStatus: (s) => s < 500 }, { status: 404, data: 'still ok' });

    @Client(client) class Api { @Get('https://a.com/x') x() { return request(); } }

    await expect(new Api().x()).resolves.toBe('still ok');
  });

  it('适配器抛出非 BoozeError 时包装成 NETWORK_ERROR，保留 cause', async () => {
    const cause = new Error('socket hang up');
    const client = createClient({ adapter: { name: 'broken', send: () => Promise.reject(cause) } });

    @Client(client) class Api { @Get('https://a.com/x') x() { return request(); } }

    await expect(new Api().x()).rejects.toMatchObject({ code: 'NETWORK_ERROR', cause });
  });
});

describe('@Adapter', () => {
  it('方法上的 @Adapter 覆盖客户端的适配器', async () => {
    const { client, recorder } = recordingClient();
    const local = createRecorder('local');

    @Client(client)
    class Api { @Get('https://a.com/x') @Adapter(local.adapter) x() { return request(); } }

    await new Api().x();

    expect(local.calls).toHaveLength(1);
    expect(recorder.calls).toHaveLength(0);
  });

  it('[v1 缺陷 #16] 类上的 @Adapter 优先于客户端的适配器', async () => {
    const { client, recorder } = recordingClient();
    const classLevel = createRecorder('class');

    @Client(client)
    @Adapter(classLevel.adapter)
    class Api { @Get('https://a.com/x') x() { return request(); } }

    await new Api().x();

    expect(classLevel.calls).toHaveLength(1);
    expect(recorder.calls).toHaveLength(0);
  });

  it('[v1 缺陷 #17] 方法可以指定另一个适配器（v2 直接传适配器对象，不再按名称查找）', async () => {
    const { client } = recordingClient();
    const b = createRecorder('B', { data: 'from B' });

    @Client(client)
    class Api { @Get('https://a.com/x') @Adapter(b.adapter) x() { return request<string>(); } }

    await expect(new Api().x()).resolves.toBe('from B');
  });

  it('优先级：方法 > 类 > 客户端', async () => {
    const { client } = recordingClient();
    const classLevel = createRecorder('class');
    const methodLevel = createRecorder('method');

    @Client(client)
    @Adapter(classLevel.adapter)
    @Prefix('https://a.com')
    class Api {
      @Get('/m') @Adapter(methodLevel.adapter) m() { return request(); }
      @Get('/c') c() { return request(); }
    }

    await new Api().m();
    await new Api().c();

    expect(methodLevel.calls.map((c) => c.url)).toEqual(['https://a.com/m']);
    expect(classLevel.calls.map((c) => c.url)).toEqual(['https://a.com/c']);
  });
});

describe('@Timeout', () => {
  it('优先级：单次调用 > 方法 > 类 > 客户端', async () => {
    const { client, recorder } = recordingClient({ baseURL: 'https://a.com', timeout: 1 });

    @Client(client)
    @Timeout(2)
    class Api {
      @Get('/a') a() { return request(); }
      @Get('/b') @Timeout(3) b() { return request(); }
      @Get('/c') @Timeout(3) c() { return request({ timeout: 4 }); }
    }

    @Client(client)
    class Plain { @Get('/d') d() { return request(); } }

    const api = new Api();
    await api.a();
    await api.b();
    await api.c();
    await new Plain().d();

    expect(recorder.calls.map((c) => c.timeout)).toEqual([2, 3, 4, 1]);
  });
});
