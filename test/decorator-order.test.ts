/**
 * 装饰器顺序
 *
 * legacy 装饰器自下而上执行。@Get 等在执行时就读取了写在“下方”的装饰器挂在原方法上的标记，
 * 写在它“上方”的装饰器执行得更晚，标记挂上去时已经没人读了 → 被静默忽略，没有任何报错。
 *
 * 每个装饰器都测两种写法：
 *   - 写在 @Get 下方（readme 要求的写法）→ 生效
 *   - 写在 @Get 上方 → [BUG] 应同样生效，当前被静默忽略
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  Adapter, After, Before, BodyType, Get, Headers, JSONP, Prefix, regAdapter,
} from '../src';
import { createRecorder } from './helpers';

const rec = createRecorder('recorder', { data: 1 });
const other = createRecorder('other', { data: 'other' });
regAdapter(rec.adapter);

beforeEach(() => {
  rec.reset();
  other.reset();
});

// @Get 写在最上面（readme 要求的写法）
@Prefix('https://o.com')
class GetFirst {
  @Get('/x') @Headers('X-A', '1') headers() {}
  @Get('/x') @BodyType(BodyType.Type.JSON) bodyType() {}
  @Get('/x') @JSONP() jsonp() {}
  @Get('/x') @Before(() => false) before() {}
  @Get('/x') @After(() => 'replaced') after() {}
  @Get('/x') @Adapter(other.adapter) adapter() {}
}

// @Get 写在最下面
@Prefix('https://o.com')
class GetLast {
  @Headers('X-A', '1') @Get('/x') headers() {}
  @BodyType(BodyType.Type.JSON) @Get('/x') bodyType() {}
  @JSONP() @Get('/x') jsonp() {}
  @Before(() => false) @Get('/x') before() {}
  @After(() => 'replaced') @Get('/x') after() {}
  @Adapter(other.adapter) @Get('/x') adapter() {}
}

type Method = keyof GetFirst;

const cases: Array<{ decorator: string; method: Method; assert: (result: unknown) => void }> = [
  {
    decorator: '@Headers',
    method: 'headers',
    assert: () => expect(rec.last.headers).toMatchObject({ 'X-A': '1' }),
  },
  {
    decorator: '@BodyType',
    method: 'bodyType',
    assert: () => expect(rec.last.headers['Content-Type']).toBe('application/json'),
  },
  {
    decorator: '@JSONP',
    method: 'jsonp',
    assert: () => expect(rec.last.jsonp).toMatch(/^__callback_/),
  },
  {
    decorator: '@Before',
    method: 'before',
    assert: () => expect(rec.calls).toHaveLength(0),
  },
  {
    decorator: '@After',
    method: 'after',
    assert: (result) => expect(result).toBe('replaced'),
  },
  {
    decorator: '@Adapter',
    method: 'adapter',
    assert: () => expect(other.calls).toHaveLength(1),
  },
];

describe.each(cases)('$decorator', ({ method, assert }) => {
  it('写在 @Get 下方时生效', async () => {
    assert(await new GetFirst()[method]());
  });

  it.fails('[BUG] 写在 @Get 上方时也应生效（当前被静默忽略）', async () => {
    assert(await new GetLast()[method]());
  });
});

describe('类装饰器', () => {
  it('类装饰器之间的顺序不影响结果（在调用时才读取）', async () => {
    const log: string[] = [];

    @Prefix('https://a.com')
    @Before(() => { log.push('a'); })
    class A { @Get('/x') x() {} }

    @Before(() => { log.push('b'); })
    @Prefix('https://b.com')
    class B { @Get('/x') x() {} }

    await new A().x();
    expect(rec.last.url).toBe('https://a.com/x');
    await new B().x();
    expect(rec.last.url).toBe('https://b.com/x');
    expect(log).toEqual(['a', 'b']);
  });
});
