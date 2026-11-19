import type { BoozeRequestConfig } from '../src/types';

/**
 * 记录型适配器：不发真实请求，只把 booze 交给适配器的配置存下来。
 */
export const createRecorder = <R = unknown>(name = 'recorder', response: R | ((config: BoozeRequestConfig) => R) = { ok: true } as R) => {
  const calls: BoozeRequestConfig[] = [];

  const adapter = {
    name,
    handler: async (config: BoozeRequestConfig) => {
      calls.push(config);

      return typeof response === 'function'
        ? (response as (config: BoozeRequestConfig) => R)(config)
        : response;
    },
  };

  return {
    adapter,
    calls,
    get last() {
      return calls[calls.length - 1];
    },
    reset() {
      calls.length = 0;
    },
  };
};
