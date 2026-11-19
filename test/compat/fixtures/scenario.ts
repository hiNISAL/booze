// Compiled by every compiler in both decorator modes and run in Node (see ../matrix.test.ts).
// It prints one JSON line; every compiler must produce the same line.
import { Before, Client, createClient, Get, Headers, Post, Prefix, request, Use, type Adapter } from 'booze';

const calls: string[] = [];
const log: string[] = [];

const adapter: Adapter = {
  name: 'recorder',
  async send(req) {
    calls.push(`${req.method} ${req.url} ${JSON.stringify(req.headers)}`);
    return { status: 200, headers: { 'x-n': String(calls.length) }, data: { n: calls.length }, raw: null };
  },
};

const http = createClient({ baseURL: 'https://api.test', adapter });

http.use(async (_ctx, next) => {
  log.push('client:in');
  await next();
  log.push('client:out');
});

@Prefix('/base')
@Headers({ 'X-Level': 'base' })
@Client(http)
class Base {
  @Headers('X-A', 'upper')
  @Get('/items/:id')
  @Headers('X-A', 'lower')
  @Use(async (_ctx, next) => {
    log.push('method:in');
    await next();
    log.push('method:out');
  })
  item(id: number) {
    return request<{ n: number }>({ path: { id } });
  }

  @Before(() => false)
  @Post('/blocked')
  blocked() {
    return request();
  }

  @Get('/static')
  static ping() {
    return request.full<{ n: number }>();
  }
}

@Use(async (_ctx, next) => {
  log.push('child:in');
  await next();
  log.push('child:out');
})
@Prefix('/child')
class Child extends Base {}

const out = {
  item: await new Base().item(0),
  childItem: await new Child().item(1),
  blocked: await new Base().blocked().then(() => 'resolved', (error: { code?: string }) => error.code),
  ping: await Child.ping(),
  calls,
  log,
};

console.log(JSON.stringify(out));
