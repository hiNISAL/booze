/**
 * 内置 axios 适配器（adapters/axios.ts）
 * axios 被 mock，只检查传给 axios 的配置。
 * 约定同 http-methods.test.ts：it.fails + [BUG] = 已知缺陷。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import jsonpAdapter from 'axios-jsonp';
import axiosAdapter from '../adapters/axios';
import type { BoozeRequestConfig } from '../src/types';

vi.mock('axios', () => ({ default: vi.fn(async () => ({ status: 200, data: 'body' })) }));
vi.mock('axios-jsonp', () => ({ default: vi.fn() }));

const axiosMock = vi.mocked(axios as unknown as (config: any) => Promise<unknown>);

const makeConfig = (patch: Partial<BoozeRequestConfig>): BoozeRequestConfig => ({
  url: 'https://a.com/x',
  method: 'GET',
  queryString: '',
  query: {},
  params: {},
  headers: {},
  eachHeaders: {},
  jsonp: null,
  onProgress: null,
  cancel: null,
  _prefix: 'https://a.com',
  _url: '/x',
  ...patch,
});

const lastAxiosConfig = () => axiosMock.mock.lastCall![0];

beforeEach(() => {
  axiosMock.mockClear();
});

describe('axios 适配器', () => {
  it('GET：query 拼到 URL 上，headers 透传', async () => {
    await axiosAdapter.handler(makeConfig({ query: { a: '1' }, headers: { 'X-A': '1' } }));

    expect(lastAxiosConfig()).toMatchObject({
      url: 'https://a.com/x?a=1',
      method: 'GET',
      headers: { 'X-A': '1' },
    });
  });

  it('POST：params 作为 data', async () => {
    await axiosAdapter.handler(makeConfig({ method: 'POST', params: { p: 1 } }));

    expect(lastAxiosConfig()).toMatchObject({ url: 'https://a.com/x', method: 'POST', data: { p: 1 } });
  });

  it('（现状）返回完整的 AxiosResponse，而不是 response.data', async () => {
    await expect(axiosAdapter.handler(makeConfig({}))).resolves.toEqual({ status: 200, data: 'body' });
  });

  it.fails('[BUG] 非 GET 请求的 query 也应拼到 URL 上（当前被丢弃）', async () => {
    await axiosAdapter.handler(makeConfig({ method: 'POST', query: { q: '2' }, params: { p: 1 } }));

    expect(lastAxiosConfig().url).toBe('https://a.com/x?q=2');
  });

  it.fails('[BUG] config.jsonp 有值时应走 JSONP（当前只判断 method === "JSONP"，而 booze 从不产生该 method）', async () => {
    await axiosAdapter.handler(makeConfig({ jsonp: '__callback_abc' }));

    expect(lastAxiosConfig().adapter).toBe(jsonpAdapter);
  });
});
