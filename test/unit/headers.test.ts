/**
 * @Headers / @BodyType, and how headers from each layer are merged.
 * [v1 缺陷 #n] = v1 known-defect case rewritten against the v2 API.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { BodyType, Client, Get, Headers, Post, Prefix, request } from '../../src';
import { recordingClient } from '../support/recorder';

const { client, recorder } = recordingClient({ baseURL: 'https://h.com', headers: { 'X-Client': 'c', 'X-Shared': 'client' } });

beforeEach(() => recorder.reset());

const body = { a: 1 };

@Client(client)
@Headers({ 'X-Class': 'c', 'X-Shared': 'class' })
class Api {
  @Get('/kv') @Headers('X-Key', 'v') kv() { return request(); }
  @Get('/obj') @Headers({ 'X-Obj': '1', 'X-Shared': 'method' }) obj() { return request(); }
  @Get('/fn') @Headers((ctx) => ({ 'X-Url': ctx.request.url })) fn() { return request(); }
  @Get('/async-fn') @Headers(async () => ({ 'X-Token': await Promise.resolve('t') })) asyncFn() { return request(); }
  @Get('/call') @Headers({ 'X-Shared': 'method' }) call() { return request({ headers: { 'X-Shared': 'call' } }); }
  @Get('/stack') @Headers('X-A', '1') @Headers('X-B', '2') stacked() { return request(); }
  @Get('/conflict') @Headers('X-A', 'upper') @Headers('X-A', 'lower') conflict() { return request(); }

  @Post('/json') json() { return request({ body }); }
  @Post('/form') @BodyType('form') form() { return request({ body: { a: 1, b: [2, 3] } }); }
  @Post('/text') @BodyType('text') text() { return request({ body: 42 }); }
  @Post('/explicit') @Headers('Content-Type', 'text/plain') explicit() { return request({ body }); }
  @Post('/fn-json') @Headers(() => ({ 'X-A': '1' })) @BodyType('json') fnWithBodyType() { return request({ body }); }
  @Post('/native') @BodyType('form') native() { return request({ body: 'raw=string' }); }
  @Post('/empty') @BodyType('form') empty() { return request(); }
}

@Client(client)
@Prefix('/class-level')
@BodyType('form')
@Headers((ctx) => ({ 'X-Class-Fn': ctx.request.method }))
class ClassLevelApi {
  @Post('/inherit') inherit() { return request({ body }); }
  @Post('/override') @BodyType('json') override() { return request({ body }); }
}

const api = new Api();
const classLevel = new ClassLevelApi();

describe('@Headers', () => {
  it('(name, value) 形式；键名统一转小写', async () => {
    await api.kv();

    expect(recorder.last.headers).toMatchObject({ 'x-key': 'v' });
  });

  it('客户端 → 类 → 方法逐层合并，同名时后一层覆盖', async () => {
    await api.obj();

    expect(recorder.last.headers).toEqual({ 'x-client': 'c', 'x-class': 'c', 'x-obj': '1', 'x-shared': 'method' });
  });

  it('单次调用传入的 headers 优先级最高', async () => {
    await api.call();

    expect(recorder.last.headers['x-shared']).toBe('call');
  });

  it('函数形式接收 ctx', async () => {
    await api.fn();

    expect(recorder.last.headers).toMatchObject({ 'x-url': 'https://h.com/fn' });
  });

  it('函数形式可以是 async', async () => {
    await api.asyncFn();

    expect(recorder.last.headers).toMatchObject({ 'x-token': 't' });
  });

  it('类上的函数形式 headers', async () => {
    await classLevel.inherit();

    expect(recorder.last.headers).toMatchObject({ 'x-class-fn': 'POST' });
  });

  it('[v1 缺陷 #6] 多个 @Headers 叠加生效', async () => {
    await api.stacked();

    expect(recorder.last.headers).toMatchObject({ 'x-a': '1', 'x-b': '2' });
  });

  it('同一层的 @Headers 键冲突时，写在上方的覆盖下方的', async () => {
    await api.conflict();

    expect(recorder.last.headers['x-a']).toBe('upper');
  });
});

describe('@BodyType', () => {
  it('默认 json：序列化 body，content-type 为 application/json', async () => {
    await api.json();

    expect(recorder.last.body).toBe('{"a":1}');
    expect(recorder.last.headers['content-type']).toBe('application/json');
  });

  it('form：按 query 的规则序列化', async () => {
    await api.form();

    expect(recorder.last.body).toBe('a=1&b=2&b=3');
    expect(recorder.last.headers['content-type']).toBe('application/x-www-form-urlencoded');
  });

  it('text：转成字符串', async () => {
    await api.text();

    expect(recorder.last.body).toBe('42');
    expect(recorder.last.headers['content-type']).toBe('text/plain;charset=UTF-8');
  });

  it('类上的 @BodyType 对所有方法生效', async () => {
    await classLevel.inherit();

    expect(recorder.last.headers['content-type']).toBe('application/x-www-form-urlencoded');
  });

  it('方法上的 @BodyType 覆盖类上的', async () => {
    await classLevel.override();

    expect(recorder.last.headers['content-type']).toBe('application/json');
  });

  it('@Headers 显式设置的 Content-Type 优先于 @BodyType', async () => {
    await api.explicit();

    expect(recorder.last.headers['content-type']).toBe('text/plain');
    expect(recorder.last.body).toBe('{"a":1}');
  });

  it('[v1 缺陷 #7] 与函数形式的 @Headers 同时使用时，Content-Type 不丢失', async () => {
    await api.fnWithBodyType();

    expect(recorder.last.headers).toMatchObject({ 'x-a': '1', 'content-type': 'application/json' });
  });

  it('字符串等原生 body 原样发送，不设置 content-type', async () => {
    await api.native();

    expect(recorder.last.body).toBe('raw=string');
    expect(recorder.last.headers).not.toHaveProperty('content-type');
  });

  it('没有 body 时不设置 content-type', async () => {
    await api.empty();

    expect(recorder.last.body).toBeUndefined();
    expect(recorder.last.headers).not.toHaveProperty('content-type');
  });
});
