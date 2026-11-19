import type { Context, Middleware } from '../types';

/**
 * Onion-style composition. `next()` may be called more than once: each call runs the inner
 * middleware and the core handler again (this is how retry works).
 */
export const compose = (middleware: readonly Middleware[], core: (ctx: Context) => Promise<void>) =>
  (ctx: Context): Promise<void> => {
    const dispatch = async (index: number): Promise<void> => {
      const current = middleware[index];

      if (!current) return core(ctx);

      await current(ctx, () => dispatch(index + 1));
    };

    return dispatch(0);
  };
