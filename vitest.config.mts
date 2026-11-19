import { transform } from 'esbuild';
import { defineConfig, type Plugin } from 'vitest/config';

/**
 * Vite 8 transforms TypeScript with Oxc, which only lowers legacy decorators:
 * TC39 standard decorators are left as `@` syntax and Node cannot run them.
 * The `standard` project therefore compiles .ts files with esbuild instead.
 */
const standardDecorators = (): Plugin => ({
  name: 'booze:standard-decorators',
  enforce: 'pre',
  async transform(code, id) {
    if (!/\.[cm]?ts$/.test(id) || id.includes('/node_modules/')) return null;

    const result = await transform(code, {
      loader: 'ts',
      format: 'esm',
      target: 'es2022',
      sourcemap: true,
      sourcefile: id,
      tsconfigRaw: { compilerOptions: { experimentalDecorators: false, useDefineForClassFields: true } },
    });

    return { code: result.code, map: result.map };
  },
});

const shared = {
  include: ['test/unit/**/*.test.ts'],
  environment: 'node',
  restoreMocks: true,
} as const;

const typecheck = (tsconfig: string) => ({
  enabled: true,
  checker: 'tsc',
  tsconfig,
  include: ['test/types/**/*.test-d.ts'],
});

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**'],
    },
    projects: [
      {
        oxc: false,
        plugins: [standardDecorators()],
        test: { ...shared, name: 'standard', typecheck: typecheck('test/tsconfig.json') },
      },
      {
        oxc: { decorator: { legacy: true } },
        test: { ...shared, name: 'legacy', typecheck: typecheck('test/tsconfig.legacy.json') },
      },
      {
        test: { name: 'compat', include: ['test/compat/**/*.test.ts'], environment: 'node' },
      },
    ],
  },
});
