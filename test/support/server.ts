import { createServer, type IncomingHttpHeaders } from 'node:http';
import type { AddressInfo } from 'node:net';

export interface Seen {
  method?: string;
  url?: string;
  headers: IncomingHttpHeaders;
  body: string;
}

/**
 * A local HTTP server for adapter end-to-end tests.
 *   /slow     answers after 500 ms
 *   /empty    204
 *   /text     200 text/plain "not json"
 *   /missing  404 JSON
 *   /big      200 with a 64 KiB text body
 *   anything else: 200 JSON { echo: <request body as JSON or null>, page: 1 }
 * CORS is open so browser-like environments can call it.
 */
export const startServer = async () => {
  let last: Seen | undefined;

  const server = createServer((req, res) => {
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': '*',
      'access-control-expose-headers': '*',
    };

    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors).end();
      return;
    }

    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => { body += chunk; });
    req.on('end', () => {
      last = { method: req.method, url: req.url, headers: req.headers, body };
      const path = req.url ?? '';

      if (path.startsWith('/slow')) {
        const timer = setTimeout(() => res.writeHead(200, cors).end('late'), 500);
        res.on('close', () => clearTimeout(timer));
        return;
      }

      if (path.startsWith('/empty')) {
        res.writeHead(204, cors).end();
        return;
      }

      if (path.startsWith('/text')) {
        res.writeHead(200, { ...cors, 'content-type': 'text/plain' }).end('not json');
        return;
      }

      if (path.startsWith('/missing')) {
        res.writeHead(404, { ...cors, 'content-type': 'application/json' }).end('{"message":"missing"}');
        return;
      }

      if (path.startsWith('/big')) {
        const big = 'x'.repeat(64 * 1024);
        res.writeHead(200, { ...cors, 'content-type': 'text/plain', 'content-length': String(big.length) }).end(big);
        return;
      }

      let echo: unknown = null;
      try { echo = body ? JSON.parse(body) : null; } catch { echo = body; }

      res.writeHead(200, { ...cors, 'content-type': 'application/json', 'x-reply': 'yes' })
        .end(JSON.stringify({ echo, page: 1 }));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    get last(): Seen {
      if (!last) throw new Error('the server has not received a request yet');
      return last;
    },
    close: () => new Promise<void>((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    }),
  };
};
