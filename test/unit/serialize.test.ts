/** URL joining, path parameters, query and body serialization. */
import { describe, expect, it } from 'vitest';
import { serializeBody } from '../../src/core/body';
import { appendQuery, fillPath, joinURL, serializeQuery } from '../../src/core/url';

describe('joinURL', () => {
  it.each([
    [['https://a.com', '/v1', '/users'], 'https://a.com/v1/users'],
    [['https://a.com/', 'v1/', 'users'], 'https://a.com/v1/users'],
    [['https://a.com', '/v1', '/'], 'https://a.com/v1/'],
    [['https://a.com', undefined, '/x'], 'https://a.com/x'],
    [['https://a.com', '/v1', ''], 'https://a.com/v1'],
    [['https://a.com', 'https://b.com/api', '/x'], 'https://b.com/api/x'],
    [['https://a.com', '/v1', '//cdn.com/x'], '//cdn.com/x'],
    [[undefined, '/v1', '/x'], '/v1/x'],
  ] as const)('%j → %s', (parts, expected) => {
    expect(joinURL(...parts)).toBe(expected);
  });
});

describe('fillPath', () => {
  it('不会把端口号当成占位符', () => {
    expect(fillPath('http://localhost:8080/users/:id', { id: 1 })).toBe('http://localhost:8080/users/1');
  });

  it('只替换路径部分，不动 query 里的冒号', () => {
    expect(fillPath('/x/:id?at=10:30', { id: 'a' })).toBe('/x/a?at=10:30');
  });

  it('缺少值时抛出 MISSING_PATH_PARAM', () => {
    expect(() => fillPath('/x/:id', {})).toThrow(expect.objectContaining({ code: 'MISSING_PATH_PARAM' }));
  });
});

describe('serializeQuery', () => {
  it('数组重复键名、嵌套对象用方括号、Date 转 ISO、undefined 跳过、null 为空值', () => {
    const at = new Date('2026-01-02T03:04:05.000Z');

    expect(serializeQuery({ a: [1, 2], b: { c: 2, d: { e: 'x y' } }, at, skip: undefined, empty: null })).toBe(
      'a=1&a=2&b%5Bc%5D=2&b%5Bd%5D%5Be%5D=x%20y&at=2026-01-02T03%3A04%3A05.000Z&empty=',
    );
  });
});

describe('appendQuery', () => {
  it.each([
    ['/x', 'a=1', '/x?a=1'],
    ['/x?b=2', 'a=1', '/x?b=2&a=1'],
    ['/x?', 'a=1', '/x?a=1'],
    ['/x#top', 'a=1', '/x?a=1#top'],
    ['/x', '', '/x'],
  ])('%s + %s → %s', (url, qs, expected) => {
    expect(appendQuery(url, qs)).toBe(expected);
  });
});

describe('serializeBody', () => {
  const run = (body: unknown, type: Parameters<typeof serializeBody>[1], headers: Record<string, string> = {}) => {
    const result = serializeBody(body, type, headers, serializeQuery);
    return { result, headers };
  };

  it('json 也会序列化数组和类实例（按 toJSON）', () => {
    class Point { constructor(public x: number) {} }

    expect(run([1, 2], 'json').result).toBe('[1,2]');
    expect(run(new Point(1), 'json').result).toBe('{"x":1}');
  });

  it.each([
    ['FormData', () => new FormData()],
    ['Blob', () => new Blob(['x'])],
    ['URLSearchParams', () => new URLSearchParams('a=1')],
    ['ArrayBuffer', () => new ArrayBuffer(2)],
    ['Uint8Array', () => new Uint8Array(2)],
  ])('%s 原样传递，不设置 content-type', (_name, make) => {
    const body = make();
    const { result, headers } = run(body, 'json');

    expect(result).toBe(body);
    expect(headers).toEqual({});
  });

  it('multipart 把普通对象转成 FormData，数组逐项 append', () => {
    const { result, headers } = run({ a: '1', tags: ['x', 'y'], skip: undefined }, 'multipart');

    expect(result).toBeInstanceOf(FormData);
    expect([...(result as FormData).entries()]).toEqual([['a', '1'], ['tags', 'x'], ['tags', 'y']]);
    expect(headers).toEqual({});
  });

  it('raw 原样传递', () => {
    const body = { a: 1 };

    expect(run(body, 'raw').result).toBe(body);
  });

  it('已有 content-type 时不覆盖', () => {
    expect(run({ a: 1 }, 'json', { 'content-type': 'application/vnd.api+json' }).headers['content-type'])
      .toBe('application/vnd.api+json');
  });
});
