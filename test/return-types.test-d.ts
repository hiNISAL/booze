/**
 * 返回值类型推断（类型测试，由 tsc 检查，不在运行时执行）。
 *
 * 被 @Get 等装饰的方法，运行时返回的是 Promise<适配器的响应>，
 * 但 TS 的装饰器（legacy 和标准装饰器都一样）不能改变被装饰成员的类型，
 * 所以类型上仍是“方法体的返回值” —— 也就是请求参数。
 *
 * 约定：标题以 [BUG] 开头的用例，用 `// @ts-expect-error` 标在“正确的期望”上。
 * 修好后这一行不再报错，tsc 会提示 “Unused '@ts-expect-error' directive”，届时删掉注释即可。
 */
import { describe, expectTypeOf, it } from 'vitest';
import { Get, makeBody, Post, Prefix } from '../src';

interface User {
  id: number;
  name: string;
}

@Prefix('https://t.com')
class Api {
  @Get('/list') getList(page: number) { return { page }; }

  // readme 推荐的写法：用 as 把“参数”断言成“响应”的类型
  @Get('/user') getUserAs() { return {} as User; }

  @Get('/user/:id') getUserPath(id: number) { return [{}, { id }]; }

  @Post('/x') withMakeBody() { return makeBody({ params: { a: 1 } }); }

  @Post('/remove') remove() {}

  @Get('/async') async asyncSource() { return { a: 1 }; }
}

const api = new Api();

describe('返回值类型', () => {
  it('（现状）调用结果被推断为“请求参数”的类型', () => {
    expectTypeOf(api.getList(1)).toEqualTypeOf<{ page: number }>();
  });

  it('[BUG] 调用结果在类型上应是 Promise（运行时就是 Promise）', () => {
    // @ts-expect-error 当前类型是 { page: number }
    expectTypeOf(api.getList(1)).toExtend<Promise<unknown>>();
    // @ts-expect-error 当前类型是 ({ id?: undefined } | { id: number })[]
    expectTypeOf(api.getUserPath(1)).toExtend<Promise<unknown>>();
    // @ts-expect-error 当前类型是 makeBody 的入参对象
    expectTypeOf(api.withMakeBody()).toExtend<Promise<unknown>>();
    // @ts-expect-error 当前类型是 void —— 拿不到响应
    expectTypeOf(api.remove()).toExtend<Promise<unknown>>();
  });

  it('[BUG] readme 的 `as User` 写法：类型是 User 而不是 Promise<User>', () => {
    expectTypeOf(api.getUserAs()).toEqualTypeOf<User>();

    // @ts-expect-error 运行时有 .then / .catch，类型上没有
    void api.getUserAs().then;
    // @ts-expect-error 不能传给需要 Promise<User> 的地方
    const p: Promise<User> = api.getUserAs();
    void p;
  });

  it('[BUG] async 原方法：类型是 Promise<请求参数> 而不是 Promise<响应>', () => {
    // 能编译，但声称 await 的结果是 { a: number }，实际是适配器的响应
    expectTypeOf(api.asyncSource()).resolves.toEqualTypeOf<{ a: number }>();
  });

  it('[BUG] 无法在不撒谎的前提下声明响应类型', () => {
    class Typed {
      // 想表达“参数是 { page }，响应是 User[]”—— 当前做不到：
      // @ts-expect-error 返回类型必须与方法体一致，而方法体返回的是参数
      @Get('/list') getList(page: number): Promise<User[]> { return { page }; }
    }

    void Typed;
  });
});
