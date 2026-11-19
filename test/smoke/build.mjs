// Compiles app.ts in both decorator modes, to ESM and CJS. Needs dist/ (pnpm build) and the dev
// dependencies, so CI runs it on a current Node before switching to the Node under test.
import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const dir = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(dir, '.out');

rmSync(out, { recursive: true, force: true });

for (const mode of ['standard', 'legacy']) {
  for (const format of ['esm', 'cjs']) {
    await build({
      entryPoints: [path.join(dir, 'app.ts')],
      outfile: path.join(out, `${mode}.${format === 'esm' ? 'mjs' : 'cjs'}`),
      bundle: true,
      // Resolved at runtime through the package's own exports map, i.e. against dist/.
      external: ['booze', 'booze/*'],
      platform: 'node',
      format,
      target: 'node18',
      tsconfigRaw: { compilerOptions: { experimentalDecorators: mode === 'legacy' } },
      logLevel: 'warning',
    });
  }
}

console.log(`built ${out}`);
