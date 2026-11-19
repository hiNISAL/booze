import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    middleware: 'src/middleware/index.ts',
    'adapters/axios': 'src/adapters/axios.ts',
    'adapters/xhr': 'src/adapters/xhr.ts',
    'adapters/jsonp': 'src/adapters/jsonp.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  platform: 'neutral',
  target: 'es2022',
  sourcemap: true,
  clean: true,
  // An optional peer dependency: never bundle it.
  external: ['axios'],
});
