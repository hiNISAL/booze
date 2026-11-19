/**
 * TypeScript compatibility: a consumer file must compile with tsc in both decorator modes.
 * [v1 缺陷 #26] v1 only worked with experimentalDecorators; standard mode failed with
 * TS1238 / TS1241.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../..');
const tsc = path.join(root, 'node_modules/.bin/tsc');
const fixture = path.join(root, 'test/compat/fixtures/consumer.ts');

const typecheck = (extraArgs: string[]) => {
  try {
    execFileSync(tsc, [
      ...extraArgs,
      '--ignoreConfig',
      '--noEmit',
      '--strict',
      '--skipLibCheck',
      '--target', 'es2022',
      '--lib', 'es2022,dom',
      '--module', 'preserve',
      '--moduleResolution', 'bundler',
      '--types', 'node',
      fixture,
    ], { encoding: 'utf8', cwd: root });

    return { ok: true, output: '' };
  } catch (error) {
    return { ok: false, output: String((error as { stdout?: string }).stdout) };
  }
};

describe('tsc 7', () => {
  it('[v1 缺陷 #26] 标准装饰器（TS 5+ 的默认模式）下可以通过类型检查', () => {
    expect(typecheck([])).toEqual({ ok: true, output: '' });
  }, 30_000);

  it('legacy 装饰器（experimentalDecorators）下可以通过类型检查', () => {
    expect(typecheck(['--experimentalDecorators'])).toEqual({ ok: true, output: '' });
  }, 30_000);
});
