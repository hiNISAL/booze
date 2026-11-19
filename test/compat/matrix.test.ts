/**
 * Compiler matrix: the same consumer code (fixtures/scenario.ts) compiled by tsc, esbuild,
 * Babel, SWC and Vite's Oxc, in both decorator modes, then run in Node. Every combination
 * must print the same result.
 *
 * Vite 8 / Oxc does not lower TC39 standard decorators at all, so it only runs in legacy mode.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { transformAsync } from '@babel/core';
import { transform as swcTransform } from '@swc/core';
import { build, transform as esbuildTransform } from 'esbuild';
import { transformWithOxc } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../..');
const fixture = path.join(root, 'test/compat/fixtures/scenario.ts');
const tmp = path.join(root, 'test/compat/.tmp');
const source = readFileSync(fixture, 'utf8');

type Mode = 'standard' | 'legacy';
type Compile = (mode: Mode) => Promise<string>;

const compilers: Record<string, { compile: Compile; modes: Mode[] }> = {
  tsc: {
    modes: ['standard', 'legacy'],
    compile: async (mode) => {
      const outDir = path.join(tmp, `tsc-${mode}`);
      execFileSync(path.join(root, 'node_modules/.bin/tsc'), [
        '--ignoreConfig', '--noCheck', '--target', 'es2022', '--module', 'esnext',
        '--rootDir', path.dirname(fixture), '--outDir', outDir, ...(mode === 'legacy' ? ['--experimentalDecorators'] : []), fixture,
      ], { cwd: root, encoding: 'utf8' });

      return readFileSync(path.join(outDir, 'scenario.js'), 'utf8');
    },
  },
  esbuild: {
    modes: ['standard', 'legacy'],
    compile: async (mode) => (await esbuildTransform(source, {
      loader: 'ts',
      format: 'esm',
      target: 'es2022',
      tsconfigRaw: { compilerOptions: { experimentalDecorators: mode === 'legacy' } },
    })).code,
  },
  babel: {
    modes: ['standard', 'legacy'],
    compile: async (mode) => (await transformAsync(source, {
      filename: fixture,
      babelrc: false,
      configFile: false,
      plugins: [
        '@babel/plugin-transform-typescript',
        ['@babel/plugin-proposal-decorators', { version: mode === 'legacy' ? 'legacy' : '2023-11' }],
      ],
    }))!.code!,
  },
  swc: {
    modes: ['standard', 'legacy'],
    compile: async (mode) => (await swcTransform(source, {
      filename: fixture,
      swcrc: false,
      jsc: {
        target: 'es2022',
        parser: { syntax: 'typescript', decorators: true },
        transform: mode === 'legacy' ? { legacyDecorator: true } : { decoratorVersion: '2023-11' },
      },
    })).code,
  },
  'vite (oxc)': {
    modes: ['legacy'],
    compile: async () => (await transformWithOxc(source, fixture, { decorator: { legacy: true }, target: 'es2022' })).code,
  },
};

/** Bundles compiled output with booze (its import resolved by `boozeEntry`) and runs it. */
const run = async (compiled: string, name: string, boozeEntry: string) => {
  const bundled = await build({
    stdin: { contents: compiled, resolveDir: path.dirname(fixture), loader: 'js', sourcefile: `${name}.js` },
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'es2022',
    alias: { booze: boozeEntry },
    write: false,
    logLevel: 'silent',
  });
  const file = path.join(tmp, `${name}.mjs`);
  writeFileSync(file, bundled.outputFiles[0]!.text);

  return JSON.parse(execFileSync(process.execPath, [file], { encoding: 'utf8' }));
};

const expected = {
  item: { n: 1 },
  childItem: { n: 2 },
  blocked: 'ABORTED',
  ping: { data: { n: 3 }, status: 200, headers: { 'x-n': '3' } },
  calls: [
    'GET https://api.test/base/items/0 {"x-level":"base","x-a":"upper"}',
    'GET https://api.test/child/items/1 {"x-level":"base","x-a":"upper"}',
    'GET https://api.test/child/static {"x-level":"base"}',
  ],
  log: [
    'client:in', 'method:in', 'method:out', 'client:out',
    'client:in', 'child:in', 'method:in', 'method:out', 'child:out', 'client:out',
    'client:in',
    'client:in', 'child:in', 'child:out', 'client:out',
  ],
};

beforeAll(() => {
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
});

afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const cases = Object.entries(compilers).flatMap(([compiler, { compile, modes }]) =>
  modes.map((mode) => ({ compiler, mode, compile })));

describe('编译矩阵（源码）', () => {
  it.each(cases)('$compiler · $mode', async ({ compiler, mode, compile }) => {
    const compiled = await compile(mode);
    const name = `${compiler.replace(/\W+/g, '-')}-${mode}`;

    await expect(run(compiled, name, path.join(root, 'src/index.ts'))).resolves.toEqual(expected);
  }, 60_000);
});

describe('构建产物（package exports）', () => {
  beforeAll(() => {
    execFileSync(path.join(root, 'node_modules/.bin/tsdown'), ['--log-level', 'error'], { cwd: root, encoding: 'utf8' });
  }, 120_000);

  it.each(['standard', 'legacy'] as const)('ESM 产物 · esbuild · %s', async (mode) => {
    const compiled = await compilers.esbuild!.compile(mode);

    await expect(run(compiled, `dist-${mode}`, path.join(root, 'dist/index.js'))).resolves.toEqual(expected);
  }, 60_000);

  it('按包名 import 和 require 所有入口（ESM 与 CJS）', () => {
    const script = `
      const names = ['booze', 'booze/middleware', 'booze/adapters/axios', 'booze/adapters/xhr', 'booze/adapters/jsonp'];
      const esm = await Promise.all(names.map((name) => import(name)));
      const { createRequire } = await import('node:module');
      const require = createRequire(import.meta.url);
      const cjs = names.map((name) => require(name));
      const shape = (mods) => mods.map((m) => Object.keys(m).filter((k) => k !== 'default').sort().join(','));
      console.log(JSON.stringify({ esm: shape(esm), cjs: shape(cjs) }));
    `;
    const file = path.join(tmp, 'exports.mjs');
    writeFileSync(file, script);

    const { esm, cjs } = JSON.parse(execFileSync(process.execPath, [file], { cwd: root, encoding: 'utf8' }));

    expect(cjs).toEqual(esm);
    expect(esm[0]).toContain('Get');
    expect(esm[0]).toContain('fetchAdapter');
    expect(esm.slice(1)).toEqual(['retry', 'axiosAdapter', 'xhrAdapter', 'JSONP,jsonpAdapter']);
  });
});
