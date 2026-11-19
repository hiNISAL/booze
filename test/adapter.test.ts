/**
 * 适配器注册与选择：regAdapter / setAdapter / @Adapter
 *
 * 适配器管理器是模块级单例，并且 @Get 等在“类定义时”就读取了当前适配器，
 * 所以每个用例都重置模块、在用例内部定义类，避免互相污染。
 * 约定同 http-methods.test.ts：it.fails + [BUG] = 已知缺陷。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRecorder } from './helpers';

const load = async () => {
  const booze = await import('../src');
  const adapterMgr = (await import('../src/adapter')).default;

  return { ...booze, adapterMgr };
};

beforeEach(() => {
  vi.resetModules();
});

describe('regAdapter / setAdapter', () => {
  it('注册单个适配器后作为默认适配器', async () => {
    const { regAdapter, Prefix, Get } = await load();
    const a = createRecorder('A');
    regAdapter(a.adapter);

    @Prefix('https://a.com')
    class Api { @Get('/x') x() {} }

    await new Api().x();

    expect(a.calls).toHaveLength(1);
  });

  it('注册数组时默认使用第一个', async () => {
    const { regAdapter, Prefix, Get } = await load();
    const a = createRecorder('A');
    const b = createRecorder('B');
    regAdapter([a.adapter, b.adapter]);

    @Prefix('https://a.com')
    class Api { @Get('/x') x() {} }

    await new Api().x();

    expect(a.calls).toHaveLength(1);
    expect(b.calls).toHaveLength(0);
  });

  it('（现状）类定义时还没注册适配器 → 调用时取当时的全局适配器', async () => {
    const { setAdapter, Prefix, Get } = await load();

    @Prefix('https://a.com')
    class Api { @Get('/x') x() {} }

    const a = createRecorder('A');
    setAdapter(a.adapter);
    await new Api().x();

    expect(a.calls).toHaveLength(1);
  });

  it.fails('[BUG] 类定义之后 setAdapter 切换适配器应生效（当前方法在定义时已锁定适配器）', async () => {
    const { regAdapter, setAdapter, Prefix, Get } = await load();
    const a = createRecorder('A');
    const b = createRecorder('B');
    regAdapter([a.adapter, b.adapter]);

    @Prefix('https://a.com')
    class Api { @Get('/x') x() {} }

    setAdapter('B');
    await new Api().x();

    expect(b.calls).toHaveLength(1);
  });

  it.fails('[BUG] 多次调用 regAdapter 应追加而不是覆盖已注册列表', async () => {
    const { regAdapter, setAdapter, adapterMgr } = await load();
    const a = createRecorder('A');
    const b = createRecorder('B');

    regAdapter(a.adapter);
    regAdapter(b.adapter);
    setAdapter('A');

    expect(adapterMgr.curAdapter).toBe(a.adapter);
  });

  it('（现状）没有任何适配器时，调用抛出 TypeError 而不是明确的错误信息', async () => {
    const { Prefix, Get } = await load();

    @Prefix('https://a.com')
    class Api { @Get('/x') x() {} }

    await expect(new Api().x()).rejects.toThrow(TypeError);
  });
});

describe('@Adapter', () => {
  it('方法级 @Adapter(对象) 覆盖全局适配器', async () => {
    const { regAdapter, Adapter, Prefix, Get } = await load();
    const global = createRecorder('global');
    const local = createRecorder('local');
    regAdapter(global.adapter);

    @Prefix('https://a.com')
    class Api { @Get('/x') @Adapter(local.adapter) x() {} }

    await new Api().x();

    expect(local.calls).toHaveLength(1);
    expect(global.calls).toHaveLength(0);
  });

  it('（现状）类级 @Adapter 仅在类定义前没有注册全局适配器时生效', async () => {
    const { regAdapter, Adapter, Prefix, Get } = await load();
    const classLevel = createRecorder('classLevel');

    @Prefix('https://a.com')
    @Adapter(classLevel.adapter)
    class Api { @Get('/x') x() {} }

    regAdapter(createRecorder('global').adapter);
    await new Api().x();

    expect(classLevel.calls).toHaveLength(1);
  });

  it.fails('[BUG] 类级 @Adapter 应优先于全局适配器（当前被定义时锁定的全局适配器覆盖）', async () => {
    const { regAdapter, Adapter, Prefix, Get } = await load();
    const global = createRecorder('global');
    const classLevel = createRecorder('classLevel');
    regAdapter(global.adapter);

    @Prefix('https://a.com')
    @Adapter(classLevel.adapter)
    class Api { @Get('/x') x() {} }

    await new Api().x();

    expect(classLevel.calls).toHaveLength(1);
  });

  it.fails('[BUG] @Adapter("name") 应按名称使用已注册的适配器（当前直接抛错）', async () => {
    const { regAdapter, Adapter, Prefix, Get } = await load();
    const a = createRecorder('A');
    const b = createRecorder('B');
    regAdapter([a.adapter, b.adapter]);

    @Prefix('https://a.com')
    class Api { @Get('/x') @Adapter('B') x() {} }

    await new Api().x();

    expect(b.calls).toHaveLength(1);
  });
});
