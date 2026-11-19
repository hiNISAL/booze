/**
 * @Headers / @BodyType
 * 约定同 http-methods.test.ts：it.fails + [BUG] = 已知缺陷。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { BodyType, Get, Headers, Post, Prefix, regAdapter } from '../src';
import { createRecorder } from './helpers';

const rec = createRecorder();
regAdapter(rec.adapter);

beforeEach(() => rec.reset());

const JSON_TYPE = 'application/json';
const FORM_TYPE = 'application/x-www-form-urlencoded';

@Prefix('https://h.com')
@Headers({ 'X-Class': 'c', 'X-Shared': 'class' })
class Api {
  @Get('/kv') @Headers('X-Key', 'v') kv() {}
  @Get('/obj') @Headers({ 'X-Obj': '1', 'X-Shared': 'method' }) obj() {}
  @Get('/fn') @Headers((config) => ({ 'X-Url': config.url })) fn() {}
  @Post('/json') @BodyType(BodyType.Type.JSON) json() {}
  @Post('/form') @BodyType(BodyType.Type.Form) form() {}
  @Post('/explicit') @Headers('Content-Type', 'text/plain') @BodyType(BodyType.Type.JSON) explicit() {}
  @Post('/fn-json') @Headers(() => ({ 'X-A': '1' })) @BodyType(BodyType.Type.JSON) fnWithBodyType() {}
  @Get('/stack') @Headers('X-A', '1') @Headers('X-B', '2') stacked() {}
}

@Prefix('https://h.com')
@BodyType(BodyType.Type.Form)
@Headers((config) => ({ 'X-Class-Fn': config.method }))
class ClassLevelApi {
  @Post('/inherit') inherit() {}
  @Post('/override') @BodyType(BodyType.Type.JSON) override() {}
}

const api = new Api();
const classLevelApi = new ClassLevelApi();

describe('@Headers', () => {
  it('(key, value) 形式', async () => {
    await api.kv();

    expect(rec.last.headers).toMatchObject({ 'X-Key': 'v' });
  });

  it('对象形式；与类上的 headers 合并，同名时方法级优先', async () => {
    await api.obj();

    expect(rec.last.headers).toEqual({ 'X-Class': 'c', 'X-Obj': '1', 'X-Shared': 'method' });
  });

  it('函数形式，接收已组装的请求配置', async () => {
    await api.fn();

    expect(rec.last.headers).toMatchObject({ 'X-Url': 'https://h.com/fn', 'X-Class': 'c' });
  });

  it('类上的函数形式 headers', async () => {
    await classLevelApi.inherit();

    expect(rec.last.headers).toMatchObject({ 'X-Class-Fn': 'POST' });
  });

  it.fails('[BUG] 多个 @Headers 应叠加（当前后一个覆盖前一个）', async () => {
    await api.stacked();

    expect(rec.last.headers).toMatchObject({ 'X-A': '1', 'X-B': '2' });
  });
});

describe('@BodyType', () => {
  it('JSON → application/json', async () => {
    await api.json();

    expect(rec.last.headers['Content-Type']).toBe(JSON_TYPE);
  });

  it('Form → application/x-www-form-urlencoded', async () => {
    await api.form();

    expect(rec.last.headers['Content-Type']).toBe(FORM_TYPE);
  });

  it('类上的 BodyType 对所有方法生效', async () => {
    await classLevelApi.inherit();

    expect(rec.last.headers['Content-Type']).toBe(FORM_TYPE);
  });

  it('方法级 BodyType 覆盖类上的', async () => {
    await classLevelApi.override();

    expect(rec.last.headers['Content-Type']).toBe(JSON_TYPE);
  });

  it('@Headers 显式设置的 Content-Type 优先于 BodyType', async () => {
    await api.explicit();

    expect(rec.last.headers['Content-Type']).toBe('text/plain');
  });

  it.fails('[BUG] 与函数形式的 @Headers 同时使用时，Content-Type 不应丢失', async () => {
    await api.fnWithBodyType();

    expect(rec.last.headers).toMatchObject({ 'X-A': '1', 'Content-Type': JSON_TYPE });
  });
});
