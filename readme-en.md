# booze

[中文](./readme.md) | English

Describe HTTP APIs with TypeScript decorators. A method only says what its request carries; booze builds the URL, serializes the body, sends the request and handles errors.

> **v2 is in beta and is not compatible with v1.** To upgrade from v1, see the [migration guide](./docs/migration-en.md). The v1 docs live on the [1.x branch](https://github.com/hiNISAL/booze/tree/1.x).

```ts
import { Get, Post, Prefix, request } from 'booze';

interface User {
  id: number;
  name: string;
}

@Prefix('https://api.example.com/users')
class UserApi {
  @Get('/:id')
  get(id: number) {
    return request<User>({ path: { id } });
  }

  @Post('/')
  create(user: Omit<User, 'id'>) {
    return request<User>({ body: user });
  }
}

const api = new UserApi();
const user = await api.get(1); // typed as User
```

## Features

- **Typed results:** `api.get(1)` is a `Promise<User>`. No `as` needed.
- **Decorators in any order:** decorators only record configuration, which is read when a method is called. Above or below `@Get` makes no difference, the same decorator can be stacked, and subclasses inherit their parent's configuration.
- **Both decorator flavors:** the standard decorators that TS 5+ uses by default, and `experimentalDecorators`. Tested with tsc, esbuild, Babel, SWC and Vite.
- **Middleware:** auth, unwrapping, retries and caching are all `(ctx, next)` middleware, attached to a client, a class or a method.
- **No runtime dependencies:** uses fetch by default; axios, XHR and JSONP adapters are opt-in, and you can write your own.
- **ESM and CommonJS**, with type declarations included.

## Contents

- [Installation](#installation)
- [Compiler setup](#compiler-setup)
- [Defining APIs](#defining-apis)
- [Clients and configuration](#clients-and-configuration)
- [Middleware](#middleware)
- [Cancellation, timeouts and progress](#cancellation-timeouts-and-progress)
- [Errors](#errors)
- [Adapters](#adapters)
- [FAQ](#faq)

## Installation

```bash
npm i booze@next
```

- **Runtime:** Node.js 18 or later, or any browser, Deno or Bun with fetch. Where there is no fetch, use another [adapter](#adapters).
- **TypeScript:** 5.2 or later works with the default settings. Projects with `experimentalDecorators` turned on work as well.

## Compiler setup

booze supports both decorator flavors, detects which one is in use at runtime, and your code looks the same either way. Pick the setup for your compiler:

| Tool | Standard decorators | Legacy (`experimentalDecorators`) |
| --- | --- | --- |
| tsc, tsx, esbuild | Default | `"experimentalDecorators": true` in tsconfig |
| Vite 8, Vitest | **Not supported** | `"experimentalDecorators": true` in tsconfig |
| Babel | `@babel/plugin-proposal-decorators` with `{ version: '2023-11' }` | The same plugin with `{ version: 'legacy' }` |
| SWC | `jsc.transform.decoratorVersion: '2023-11'` | `jsc.transform.legacyDecorator: true` |

> **Vite 8 projects must turn on `experimentalDecorators`.** Vite 8 compiles TS with Oxc, which can only lower legacy decorators. Without it, `@Get` is left in the output as-is and the browser throws a syntax error.
>
> Vitest only picks this tsconfig setting up when the project has a `vite.config.*` or `vitest.config.*` file. You can also set `oxc: { decorator: { legacy: true } }` in that config file directly.

Standard decorators need `Symbol.metadata`. booze installs it when it is imported, so you need no polyfill and no `reflect-metadata`.

## Defining APIs

### HTTP methods

| Decorator | HTTP method |
| --- | --- |
| `@Get(path)` `@Post(path)` `@Put(path)` `@Delete(path)` `@Patch(path)` `@Head(path)` `@Options(path)` | The one in the name |
| `@Request(method, path)` | Any method, e.g. `@Request('PROPFIND', '/files')` |

A decorated method must **return `request()` synchronously**. The argument to `request()` describes what the request carries; the method itself can take any parameters:

```ts
class UserApi {
  @Get('/users')
  list(page = 1, keyword?: string) {
    return request<User[]>({ query: { page, keyword } });
  }
}
```

The `T` in `request<T>()` is what the method resolves to. Without `T` it is `unknown`. `T` is your own declaration: booze does not check what the server actually returns, just like the generics in axios or fetch wrappers.

### request options

All optional:

| Field | Description |
| --- | --- |
| `path` | Values for the `:name` placeholders in the path |
| `query` | Appended to the URL, for every HTTP method |
| `body` | Request body, serialized according to [`@BodyType`](#request-body) |
| `headers` | Headers for this call only; they take precedence over everything else |
| `signal` | An `AbortSignal` to cancel the request |
| `timeout` | Timeout in milliseconds; overrides every other timeout setting |
| `responseType` | `'json'` (default), `'text'`, `'blob'` or `'arrayBuffer'` |
| `onUploadProgress` / `onDownloadProgress` | Progress callbacks; support depends on the [adapter](#adapters) |
| `meta` | Free-form data for middleware; booze itself never reads it |

### URLs

The final URL joins three parts: the client's `baseURL`, the class's `@Prefix` and the method's path. booze takes care of the `/` between them. When a part is an absolute URL (`https://…` or `//…`), everything before it is dropped.

| `baseURL` | `@Prefix` | Method path | Result |
| --- | --- | --- | --- |
| `https://api.com` | `/users` | `/:id` | `https://api.com/users/1` |
| `https://api.com/v1/` | `users` | `list` | `https://api.com/v1/users/list` |
| `https://api.com` | `https://other.com` | `/x` | `https://other.com/x` |
| `https://api.com` | `/users` | `https://cdn.com/x` | `https://cdn.com/x` |

- **Path placeholders:** `:name` is replaced with `path.name`, passed through `encodeURIComponent`. `0` is a valid value; a missing value throws `MISSING_PATH_PARAM`. Only the path is touched, so the port in `http://localhost:8080` is not mistaken for a placeholder.
- **query:** arrays repeat the key (`a=1&a=2`), nested objects use brackets (`b[c]=2`), a `Date` becomes an ISO string, keys whose value is `undefined` are skipped, and `null` becomes an empty value (`a=`). For another format, give the client a `serializeQuery` function such as `qs.stringify`.

### Request body

Plain objects are serialized according to `@BodyType`, JSON by default:

| BodyType | What is sent | content-type |
| --- | --- | --- |
| `'json'` (default) | `JSON.stringify(body)` | `application/json` |
| `'form'` | `a=1&b=2`, same rules as query | `application/x-www-form-urlencoded` |
| `'multipart'` | `FormData` | Set by the platform (with the boundary) |
| `'text'` | `String(body)` | `text/plain;charset=UTF-8` |
| `'raw'` | Sent as-is | Not set |

```ts
class LoginApi {
  @BodyType('form')
  @Post('/login')
  login(username: string, password: string) {
    return request<{ token: string }>({ body: { username, password } });
  }
}
```

- **Native bodies are sent as-is:** `FormData`, `Blob`, `File`, `URLSearchParams`, `ArrayBuffer`, typed arrays, `ReadableStream` and strings skip serialization, and booze sets no content-type for them. That includes a string you produced with `JSON.stringify` yourself, so set its content-type if the server needs one.
- **Your content-type wins:** if any layer sets `content-type`, booze leaves it alone.

### Static methods

Static methods can be decorated too; `this` is the class:

```ts
class StatusApi {
  @Get('https://status.example.com/ping')
  static ping() {
    return request<{ ok: boolean }>();
  }
}

await StatusApi.ping();
```

### Types

- **Call results** are `BoozeRequest<T>`, which extends `Promise<T>`. It can be assigned to `Promise<T>` and supports `.then` and `.catch`.
- **Declared return types:** to spell out the result in the method signature, write the following; `request()` infers `T` from it:

  ```ts
  @Get('/users')
  list(page: number): BoozeRequest<User[]> {
    return request({ query: { page } });
  }
  ```

- **Compile-time errors:** a method that returns a plain object, or an `async` method. See the [FAQ](#why-cant-methods-be-async) for why.

## Clients and configuration

### Clients

A client holds shared options and middleware. Classes without `@Client` use the default client; change its options with `configure()`:

```ts
import { configure } from 'booze';

configure({ baseURL: 'https://api.example.com', timeout: 10_000 });
```

When you need several setups (two services, or two kinds of auth), create clients with `createClient()` and assign them to classes with `@Client`:

```ts
import { Client, createClient, Get, Prefix, request } from 'booze';

export const http = createClient({
  baseURL: 'https://api.example.com',
  headers: { 'x-app': 'web' },
});

@Client(http)
@Prefix('/users')
class UserApi {
  @Get('/:id')
  get(id: number) {
    return request<User>({ path: { id } });
  }
}
```

`createClient()` options:

| Option | Description |
| --- | --- |
| `baseURL` | The first part of every URL |
| `headers` | Headers sent with every request |
| `bodyType` | Default body type; `'json'` when unset |
| `timeout` | Timeout in milliseconds |
| `adapter` | The adapter that sends requests; the built-in fetch adapter when unset |
| `validateStatus` | Which statuses count as success; 2xx by default. Any other status throws `HTTP_ERROR` |
| `serializeQuery` | Replaces the default query serializer; `'form'` bodies use it too |

Client options are read on every request, so `client.configure()`, `configure()` and `client.use()` also affect classes defined earlier. `configure()` merges `headers` and replaces every other option.

### Precedence

The same setting can be made in four places. From highest to lowest precedence: the call, the method, the class, the client.

| Setting | Client | Class | Method | Call `request({...})` | How layers combine |
| --- | --- | --- | --- | --- | --- |
| URL | `baseURL` | `@Prefix` | `@Get(path)` etc. | `path` fills placeholders | Joined in order |
| Headers | `headers` | `@Headers` | `@Headers` | `headers` | Merged; names are lower-cased |
| Body type | `bodyType` | `@BodyType` | `@BodyType` | — | Overridden |
| Timeout | `timeout` | `@Timeout` | `@Timeout` | `timeout` | Overridden |
| Adapter | `adapter` | `@Adapter` | `@Adapter` | — | Overridden |
| Middleware | `use()` | `@Use` etc. | `@Use` etc. | — | Stacked; see [order](#order) |

`@Headers`, `@BodyType`, `@Timeout`, `@Adapter`, `@Use`, `@Before` and `@After` work on a class or a method. On a class they apply to all of its methods, inherited ones included.

### @Headers

Three forms, and you can stack several in one place:

```ts
@Headers({ 'x-module': 'user' })
@Headers('x-version', '2')
@Headers(async (ctx) => ({ authorization: `Bearer ${await getToken()}` }))
class UserApi {}
```

The function form receives the request context `ctx` (see [middleware](#middleware)) and may be async. When several `@Headers` in one place set the same name, the one written higher up wins.

### Inheritance

A subclass inherits all of its parent's configuration. A subclass's `@Prefix` replaces its parent's, inherited methods included:

```ts
@Prefix('/v1/users')
@Headers({ 'x-module': 'user' })
class UserApi {
  @Get('/:id')
  get(id: number) {
    return request<User>({ path: { id } });
  }
}

@Prefix('/v2/users')
class UserApiV2 extends UserApi {}

await new UserApiV2().get(1); // GET /v2/users/1, still with x-module
```

## Middleware

Middleware is a `(ctx, next) => unknown` function. Before `await next()` it can change the request; after it, it can read or replace the result:

```ts
import type { Middleware } from 'booze';

const timing: Middleware = async (ctx, next) => {
  const start = Date.now();
  await next();
  console.log(ctx.request.method, ctx.request.url, Date.now() - start, 'ms');
};
```

Middleware can go in three places:

```ts
http.use(timing);            // client: every request of this client

@Use(timing)                 // class: every method of the class
class UserApi {
  @Use(timing)               // method: this method only
  @Get('/:id')
  get(id: number) {
    return request<User>({ path: { id } });
  }
}
```

### ctx

| Field | Description |
| --- | --- |
| `ctx.request` | The request about to be sent: `method`, `url` (without the query), `query`, `headers` (lower-case names), `body`, `bodyType`, `timeout`, `signal`, `responseType`, `meta`. You can change it |
| `ctx.response` | Set after `next()`: `status`, `headers` (lower-case names), `data` (parsed), `raw` (the adapter's raw response) |
| `ctx.result` | What the method resolves to. Defaults to `ctx.response.data`; you can replace it |
| `ctx.client` | The client used for this request |
| `ctx.instance` | The method's `this`: the instance, or the class for a static method |
| `ctx.name` / `ctx.args` | The method name and the call arguments |

### Recipes

**Auth:** async preparation such as fetching a token belongs in middleware.

```ts
http.use(async (ctx, next) => {
  if (!ctx.request.meta.skipAuth) {
    ctx.request.headers.authorization = `Bearer ${await getToken()}`;
  }
  await next();
});

class AuthApi {
  @Post('/login')
  login(form: LoginForm) {
    return request<Session>({ body: form, meta: { skipAuth: true } });
  }
}
```

**Unwrapping:** when the server responds with `{ code, data, msg }`, take `data` out in middleware. The `request<T>()` in your methods then declares the unwrapped type.

```ts
http.use(async (ctx, next) => {
  await next();
  const body = ctx.result as { code: number; data: unknown; msg: string };
  if (body.code !== 0) throw new Error(body.msg);
  ctx.result = body.data;
});
```

**Caching:** a middleware that does not call `next()` sends no request. It must set `ctx.result`; otherwise the method fails with `ABORTED`.

```ts
const cache = new Map<string, unknown>();

const cached: Middleware = async (ctx, next) => {
  const key = `${ctx.request.url}?${JSON.stringify(ctx.request.query)}`;
  if (cache.has(key)) {
    ctx.result = cache.get(key);
    return;
  }
  await next();
  cache.set(key, ctx.result);
};
```

**Retries:** `booze/middleware` provides `retry()`.

```ts
import { retry } from 'booze/middleware';

http.use(retry({ retries: 3 }));
```

| Option | Default |
| --- | --- |
| `retries` | `2`, not counting the first attempt |
| `delay` | Waits `300 × 2^(n-1)` ms before retry n; a number or `(attempt, error) => number`. A numeric `Retry-After` response header takes precedence |
| `methods` | The idempotent ones: `GET`, `HEAD`, `OPTIONS`, `PUT`, `DELETE` |
| `statuses` | `408`, `429`, `500`, `502`, `503`, `504` |
| `when` | `(error, ctx) => boolean`, replaces the default decision |

By default it retries network errors, timeouts and the statuses above. Cancelled requests are never retried, and the wait between attempts can be cancelled too. `retry()` repeats only the middleware inside it and the request, so if an auth middleware should fetch a fresh token for each attempt, register `retry()` before it.

### @Before and @After

`@Before` and `@After` are shorthands for two common kinds of middleware:

```ts
@Before((ctx) => ctx.request.method !== 'DELETE' || confirm('Delete it?'))
@After((result, ctx) => {
  console.log(ctx.name, result);
})
class UserApi {}
```

- **`@Before(fn)`:** runs before the request and may be async. Returning `false` stops the request, and the method fails with `ABORTED`.
- **`@After(fn)`:** runs after a successful request and may be async. A return value other than `undefined` replaces the method's result.

### Order

Middleware runs in onion order, from the outside in: client → parent class → subclass → method.

- **Several decorators in one place:** the one written higher up is further out. In `@Use(a, b)`, `a` is outside `b`.
- **`client.use()`:** middleware registered first is further out.
- **`next()` can be called more than once:** each call runs the inner middleware and sends the request again. That is how `retry()` works.

```ts
const log = (name: string): Middleware => async (_ctx, next) => {
  console.log('enter', name);
  await next();
  console.log('leave', name);
};

http.use(log('client'));

@Client(http)
@Use(log('class'))
class Api {
  @Use(log('a'), log('b'))
  @Get('/x')
  x() {
    return request();
  }
}

// enter: client → class → a → b → request
// leave: b → a → class → client
```

### request.full

Methods resolve to the result only. When you need the status or response headers, use `request.full<T>()`:

```ts
class UserApi {
  @Get('/users')
  list(page: number) {
    return request.full<User[]>({ query: { page } });
  }
}

const { data, status, headers } = await new UserApi().list(1);
const total = Number(headers['x-total-count']);
```

`data` is the same value `request<T>()` would give you, after middleware. If a middleware produced the result without sending a request (a cache hit, say), `status` is `200` and `headers` is an empty object.

## Cancellation, timeouts and progress

```ts
class FileApi {
  @Get('/files/:id')
  download(id: string, signal?: AbortSignal, onProgress?: (p: Progress) => void) {
    return request<Blob>({
      path: { id },
      signal,
      timeout: 60_000,
      responseType: 'blob',
      onDownloadProgress: onProgress,
    });
  }
}

const controller = new AbortController();
const file = new FileApi().download('a1', controller.signal, ({ loaded, total }) => {
  console.log(loaded, total);
});
controller.abort(); // file rejects with ABORTED
```

- **Cancellation:** pass a `signal`. Once it is aborted, the method fails with `ABORTED`.
- **Timeouts:** `timeout`, `@Timeout(ms)` or the client's `timeout`, in milliseconds. On timeout the method fails with `TIMEOUT`.
- **Progress:** callbacks receive `{ loaded, total? }`. The fetch adapter only reports download progress; for upload progress use the xhr or axios adapter.

## Errors

A failed call rejects with a `BoozeError`. Its `code` tells you why:

| code | When |
| --- | --- |
| `HTTP_ERROR` | The status did not pass `validateStatus` (non-2xx by default) |
| `NETWORK_ERROR` | A network error, or the adapter threw something other than a `BoozeError` |
| `TIMEOUT` | The request timed out |
| `ABORTED` | The `signal` was aborted; `@Before` returned `false`; or a middleware neither called `next()` nor set `ctx.result` |
| `MISSING_PATH_PARAM` | A path placeholder has no value |
| `NO_ADAPTER` | No usable adapter, e.g. there is no fetch |
| `INVALID_RETURN` | The method did not return `request()` synchronously |
| `NOT_DECORATED` | `request()` was awaited directly, from a method without an HTTP method decorator |

The error also carries `ctx` (the request context), and `response` when a response was received:

```ts
import { isBoozeError } from 'booze';

try {
  await api.get(1);
} catch (error) {
  if (isBoozeError(error) && error.code === 'HTTP_ERROR') {
    console.log(error.response?.status, error.response?.data);
  }
}
```

Other errors thrown by middleware reach the caller unchanged.

## Adapters

An adapter actually sends the request. The built-in fetch adapter is the default; the others are imported from subpaths:

| Adapter | Import | Upload progress | Download progress | Notes |
| --- | --- | --- | --- | --- |
| `fetchAdapter(options?)` | `booze` | — | Yes | The default. `options.fetch` replaces the fetch function; `options.init` adds fetch options such as `credentials` |
| `axiosAdapter(instance?)` | `booze/adapters/axios` | Yes | Yes | Install axios separately. Accepts an instance from `axios.create()` |
| `xhrAdapter(options?)` | `booze/adapters/xhr` | Yes | Yes | Browsers only. `options.withCredentials` sends cookies with cross-origin requests |
| `jsonpAdapter(options?)` | `booze/adapters/jsonp` | — | — | Browsers only, GET only. `@JSONP(options)` is short for `@Adapter(jsonpAdapter(options))` |

Set an adapter on a client, a class or a method:

```ts
import { Adapter, createClient, Get, Post, request, type Progress } from 'booze';
import { axiosAdapter } from 'booze/adapters/axios';
import { JSONP } from 'booze/adapters/jsonp';
import { xhrAdapter } from 'booze/adapters/xhr';

const http = createClient({ adapter: axiosAdapter() });

class FileApi {
  @Adapter(xhrAdapter())
  @Post('/upload')
  upload(file: File, onProgress: (p: Progress) => void) {
    const form = new FormData();
    form.append('file', file);
    return request<{ url: string }>({ body: form, onUploadProgress: onProgress });
  }

  @JSONP({ callbackParam: 'cb' })
  @Get('https://other.example.com/suggest')
  suggest(word: string) {
    return request<string[]>({ query: { word } });
  }
}
```

### Custom adapters

An adapter is an object with a `name` and a `send()` method. The request `send()` receives is ready to go: the query is already in the URL, the body is serialized, and header names are lower-case.

```ts
interface Adapter {
  name: string;
  send(request: AdapterRequest): Promise<BoozeResponse>;
}
```

Adapters follow two rules:

- **Don't reject on non-2xx statuses:** return the response; booze checks the status with `validateStatus`.
- **Reject with a `BoozeError`:** `NETWORK_ERROR` for network errors, `TIMEOUT` for timeouts, `ABORTED` for cancellation. Any other error is wrapped in a `NETWORK_ERROR`.

For example, `wx.request` in a WeChat mini program:

```ts
import { BoozeError, createClient, type Adapter } from 'booze';

const wxAdapter: Adapter = {
  name: 'wx',
  send: (req) => new Promise((resolve, reject) => {
    const task = wx.request({
      url: req.url,
      method: req.method as WechatMiniprogram.RequestOption['method'],
      header: req.headers,
      data: req.body as WechatMiniprogram.RequestOption['data'],
      timeout: req.timeout,
      responseType: req.responseType === 'arrayBuffer' ? 'arraybuffer' : 'text',
      success: (res) => resolve({
        status: res.statusCode,
        headers: Object.fromEntries(Object.entries(res.header).map(([key, value]) => [key.toLowerCase(), String(value)])),
        data: res.data,
        raw: res,
      }),
      fail: (error) => {
        const code = error.errMsg.includes('abort') ? 'ABORTED' : error.errMsg.includes('timeout') ? 'TIMEOUT' : 'NETWORK_ERROR';
        reject(new BoozeError(code, error.errMsg));
      },
    });

    req.signal?.addEventListener('abort', () => task.abort(), { once: true });
  }),
};

export const http = createClient({ baseURL: 'https://api.example.com', adapter: wxAdapter });
```

## FAQ

### Why can't methods be async?

An async method returns a plain `Promise`, and neither booze nor TypeScript can tell whether it holds a request description or something else. So an async method is a compile-time error, and in plain JS it throws `INVALID_RETURN` at runtime. Put async preparation such as tokens or signing in [middleware](#recipes) or in the function form of `@Headers`.

### Why does awaiting `request()` throw `NOT_DECORATED`?

`request()` sends nothing by itself; it is a description handed to the decorator. Awaiting it from a method without `@Get` or another HTTP method decorator gives you this error.

### The browser throws a syntax error in my Vite project

Most likely the `@` decorators were not compiled. See [compiler setup](#compiler-setup): Vite 8 needs `experimentalDecorators` in tsconfig.

### Can a method have two HTTP method decorators?

No. That throws as soon as the class is defined.

## Development

```bash
pnpm install
pnpm test        # unit, end-to-end and compiler-matrix tests, once per decorator flavor
pnpm typecheck
pnpm build
```

## License

MIT
