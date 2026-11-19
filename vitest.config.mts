import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
    environment: 'node',
    restoreMocks: true,
    typecheck: {
      enabled: true,
      checker: 'tsc',
      tsconfig: 'test/tsconfig.json',
      include: ['test/**/*.test-d.ts'],
    },
    coverage: {
      provider: 'v8',
      include: ['src/**', 'adapters/**'],
    },
  },
});
