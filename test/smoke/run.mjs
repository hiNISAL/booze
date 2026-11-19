// Runs the builds from build.mjs on the current Node. Plain JS with no dependencies, so it runs
// on every Node version in `engines`.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '.out');

const echo = (method, pathname, query = '', type = null, body = '') => ({ method, path: pathname, query, type, body });

const expected = {
  get: echo('GET', '/users/0', '?q=x'),
  create: { status: 200, path: '/users/', data: echo('POST', '/users/', '', 'application/json', '{"name":"n"}') },
  flaky: { path: '/users/flaky', calls: 2 },
  missing: 'HTTP_ERROR 404',
  adapters: ['axios', 'xhr', 'jsonp'],
};

for (const file of ['standard.mjs', 'standard.cjs', 'legacy.mjs', 'legacy.cjs']) {
  const stdout = execFileSync(process.execPath, ['--no-warnings', path.join(out, file)], { encoding: 'utf8' });

  assert.deepEqual(JSON.parse(stdout), expected, file);
  console.log(`ok ${file} on Node ${process.version}`);
}
