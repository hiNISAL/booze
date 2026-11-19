// Consumer code for the runtime smoke test. build.mjs compiles it in both decorator modes, to
// ESM and CJS, with `booze` left external so it resolves to the built package (dist/). run.mjs
// then runs every build on the current Node, which in CI includes the oldest supported versions.
// It prints one JSON line.
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Client, createClient, Get, isBoozeError, Post, Prefix, request } from 'booze';
import { axiosAdapter } from 'booze/adapters/axios';
import { jsonpAdapter } from 'booze/adapters/jsonp';
import { xhrAdapter } from 'booze/adapters/xhr';
import { retry } from 'booze/middleware';

interface Echo {
  method: string;
  path: string;
  query: string;
  type: string | null;
  body: string;
}

let flakyCalls = 0;

const server = createServer((req, res) => {
  let body = '';

  req.on('data', (chunk) => {
    body += chunk;
  });

  req.on('end', () => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const send = (status: number, data: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json', 'x-path': url.pathname });
      res.end(JSON.stringify(data));
    };

    if (url.pathname === '/users/flaky' && flakyCalls++ === 0) return send(503, { error: 'try again' });
    if (url.pathname === '/users/missing') return send(404, { error: 'not found' });

    send(200, { method: req.method, path: url.pathname, query: url.search, type: req.headers['content-type'] ?? null, body });
  });
});

const main = async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  const { port } = server.address() as AddressInfo;
  const http = createClient({ baseURL: `http://127.0.0.1:${port}` }).use(retry({ delay: 0 }));

  @Client(http)
  @Prefix('/users')
  class UserApi {
    @Get('/:id')
    get(id: number, q?: string) {
      return request<Echo>({ path: { id }, query: { q } });
    }

    @Post('/')
    create(name: string) {
      return request.full<Echo>({ body: { name } });
    }

    @Get('/flaky')
    flaky() {
      return request<Echo>();
    }

    @Get('/missing')
    missing() {
      return request();
    }
  }

  const api = new UserApi();
  const created = await api.create('n');

  const out = {
    get: await api.get(0, 'x'),
    create: { status: created.status, path: created.headers['x-path'], data: created.data },
    flaky: { path: (await api.flaky()).path, calls: flakyCalls },
    missing: await api.missing().then(
      () => 'resolved',
      (error: unknown) => (isBoozeError(error) ? `${error.code} ${error.response?.status}` : String(error)),
    ),
    adapters: [axiosAdapter, xhrAdapter, jsonpAdapter].map((adapter) => adapter().name),
  };

  console.log(JSON.stringify(out));
};

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => server.close());
