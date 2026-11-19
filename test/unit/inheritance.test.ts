/**
 * Inheritance: subclasses inherit all config, and a subclass's class-level config applies to
 * inherited methods without leaking into the parent.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Client, Get, Headers, Post, Prefix, request, Use } from '../../src';
import { recordingClient } from '../support/recorder';

const { client, recorder } = recordingClient({ baseURL: 'https://i.com' });
const log: string[] = [];

beforeEach(() => {
  recorder.reset();
  log.length = 0;
});

@Client(client)
@Prefix('/base')
@Headers({ 'X-Level': 'base', 'X-Base': '1' })
@Use(async (_ctx, next) => { log.push('base-mw'); await next(); })
class Base {
  @Get('/list') list() { return request(); }
  @Get('/item/:id') item(id: number) { return request({ path: { id } }); }
  @Get('/ping') static ping() { return request(); }
}

@Prefix('/child')
@Headers({ 'X-Level': 'child' })
@Use(async (_ctx, next) => { log.push('child-mw'); await next(); })
class Child extends Base {
  @Post('/extra') extra() { return request(); }

  @Get('/item/:id/v2')
  override item(id: number) { return request({ path: { id } }); }
}

class GrandChild extends Child {}

class Override extends Base {
  @Get('/override/list') override list() { return request(); }
  callParent() { return super.list(); }
}

describe('继承', () => {
  it('子类继承父类的方法和配置；子类的 @Prefix、@Headers 对继承来的方法也生效', async () => {
    await new Child().list();

    expect(recorder.last.url).toBe('https://i.com/child/list');
    expect(recorder.last.headers).toMatchObject({ 'x-level': 'child', 'x-base': '1' });
  });

  it('子类配置不会污染父类', async () => {
    await new Child().list();
    await new Base().list();

    expect(recorder.last.url).toBe('https://i.com/base/list');
    expect(recorder.last.headers['x-level']).toBe('base');
  });

  it('父类的中间件在外层，子类的在内层', async () => {
    await new Child().list();

    expect(log).toEqual(['base-mw', 'child-mw']);
  });

  it('子类重新装饰的方法使用自己的路由', async () => {
    await new Child().item(3);

    expect(recorder.last.url).toBe('https://i.com/child/item/3/v2');
  });

  it('子类新增的方法', async () => {
    await new Child().extra();

    expect(recorder.last).toMatchObject({ method: 'POST', url: 'https://i.com/child/extra' });
  });

  it('没有装饰器的孙类沿用最近一层的配置', async () => {
    await new GrandChild().list();

    expect(recorder.last.url).toBe('https://i.com/child/list');
  });

  it('静态方法通过子类调用时，同样使用子类的配置', async () => {
    await Child.ping();
    expect(recorder.last.url).toBe('https://i.com/child/ping');

    await Base.ping();
    expect(recorder.last.url).toBe('https://i.com/base/ping');
  });

  it('super 调用父类方法时，使用父类方法自己的路由', async () => {
    const api = new Override();

    await api.list();
    expect(recorder.last.url).toBe('https://i.com/base/override/list');

    await api.callParent();
    expect(recorder.last.url).toBe('https://i.com/base/list');
  });

  it('方法被取出单独调用（this 丢失）时，退回声明它的类的配置', async () => {
    const { list } = new Child();

    await list();

    expect(recorder.last.url).toBe('https://i.com/base/list');
  });
});
