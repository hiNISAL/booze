/**
 * 与新版 TypeScript 的兼容性。
 *
 * TS 5.0 起，不开 experimentalDecorators 时默认使用 TC39 标准装饰器
 * （签名为 (value, context)），这也是 TS 7 新建项目的默认行为。
 * booze 只实现了 legacy 签名 (target, key, descriptor)。
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..');
const tsc = path.join(root, 'node_modules/.bin/tsc');
const fixture = path.join(root, 'test/fixtures/standard-decorators.ts');

const typecheck = (extraArgs: string[]) => {
  try {
    execFileSync(tsc, [
      ...extraArgs,
      '--ignoreConfig',
      '--noEmit',
      '--strict',
      '--skipLibCheck',
      '--target', 'es2022',
      '--module', 'preserve',
      '--moduleResolution', 'bundler',
      fixture,
    ], { encoding: 'utf8', cwd: root });

    return { ok: true, output: '' };
  } catch (error: any) {
    return { ok: false, output: String(error.stdout) };
  }
};

describe('TypeScript 装饰器模式', () => {
  it('开启 experimentalDecorators（legacy）时可以通过类型检查', () => {
    expect(typecheck(['--experimentalDecorators'])).toEqual({ ok: true, output: '' });
  }, 30_000);

  it('（现状）标准装饰器模式下报 TS1238 / TS1241：装饰器签名不匹配', () => {
    const { output } = typecheck([]);

    expect(output).toMatch(/TS1238/);
    expect(output).toMatch(/TS1241/);
  }, 30_000);

  it.fails('[BUG] 不开 experimentalDecorators（TS 5+ 默认的标准装饰器）也应能使用', () => {
    expect(typecheck([]).ok).toBe(true);
  }, 30_000);
});
