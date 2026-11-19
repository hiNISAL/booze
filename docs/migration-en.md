# Migrating from v1 to v2

[中文](./migration.md) | English

v2 is a rewrite, and its API is not compatible with v1. The central change: **methods return `request<T>()` instead of the request parameters**. That is what gives call results the right type and makes decorator order irrelevant.

The v1 code and docs remain on the [1.x branch](https://github.com/hiNISAL/booze/tree/1.x).

## Steps

1. Upgrade with `npm i booze@next`. Replace import paths such as `booze/release/commonjs` with `booze`. Your tsconfig can stay as it is: v1 required `experimentalDecorators`, and v2 works with or without it (Vite 8 projects must keep it on; see the [readme](../readme-en.md#compiler-setup)).
2. Replace `regAdapter` / `setAdapter` with `configure()` or `createClient()`. See [adapters](#adapters).
3. Make every method return `request<T>({...})`. See [method return values](#method-return-values), and pay special attention to GET requests.
4. Check the code that uses call results: with v1's axios adapter you got the whole axios response, while v2 gives you the response body. See [call results](#call-results).
5. Turn hooks into middleware. See [hooks](#hooks).
6. Check your error handling. See [errors](#errors).
7. Drop the `as` casts you wrote for types, and stop moving `@Get` to the top for ordering. Neither is needed any more.

## Cheat sheet

| v1 | v2 |
| --- | --- |
| `import ... from 'booze/release/commonjs'` | `import ... from 'booze'` |
| `regAdapter(axiosAdapter)` | `configure({ adapter: axiosAdapter() })` |
| `setAdapter('name')` / `setAdapter(adapter)` | `configure({ adapter })`, or several clients made with `createClient()` |
| `import axiosAdapter from 'booze/adapter/axios'` | `import { axiosAdapter } from 'booze/adapters/axios'` |
| `@Adapter('name')` | `@Adapter(adapter)`, passing the adapter object |
| Adapter `{ name, handler(config) }` | `{ name, send(request) }`; see [custom adapters](#custom-adapters) |
| `@Get(url, prefix)` | `@Get(url)`; use an absolute URL for another host |
| GET: `return { page }` | `return request<T>({ query: { page } })` |
| POST etc.: `return { name }` | `return request<T>({ body: { name } })` |
| `return [params, placeholders]` | `return request<T>({ query or body, path: placeholders })` |
| `makeBody({ params, query, placeholders, onProgress, cancel, jsonp })` | `request({ body, query, path, onDownloadProgress / onUploadProgress, signal })`; JSONP via `@JSONP()` |
| `return {} as User` | `return request<User>()` |
| `@BodyType(BodyType.Type.JSON)` | `@BodyType('json')`, the default, so you can drop it |
| `@BodyType(BodyType.Type.Form)` | `@BodyType('form')` |
| `@Headers((config) => headers)` | `@Headers((ctx) => headers)`, may be async |
| `@Before((config) => ...)` | `@Before((ctx) => ...)` |
| `@After((response, config) => ...)` | `@After((result, ctx) => ...)` |
| `@BeforeExecSourceFn(fn)` | `@Before(fn)` or `@Use(middleware)` |
| `eachBeforeExecSourceFn(fn)` | `defaultClient.use(middleware)` or `client.use(middleware)` |
| `eachAfter(fn)` | `defaultClient.use(middleware)` or `client.use(middleware)` |
| `@JSONP()` (the adapter had to implement it) | `import { JSONP } from 'booze/adapters/jsonp'`; `@JSONP()` works on its own |

## Adapters

v1 picked the adapter through global registration:

```ts
// v1
import { regAdapter } from 'booze';
import axiosAdapter from 'booze/adapter/axios';

regAdapter(axiosAdapter);
```

v2 uses fetch by default, with nothing to register. To keep using axios:

```ts
// v2
import { configure } from 'booze';
import { axiosAdapter } from 'booze/adapters/axios';

configure({ adapter: axiosAdapter() });
```

Install axios yourself. If you already have a configured axios instance, pass it in: `axiosAdapter(instance)`.

v1 used `setAdapter('name')` to switch between adapters. In v2 you create several clients and assign them to classes with `@Client`; a single class or method can also use `@Adapter(adapter)`:

```ts
// v2
import { Client, createClient } from 'booze';
import { xhrAdapter } from 'booze/adapters/xhr';

const legacy = createClient({ baseURL: 'https://old.example.com', adapter: xhrAdapter() });

@Client(legacy)
class OldApi {}
```

## Method return values

v1 methods returned the request parameters, and booze decided where they went based on the HTTP method: into the query for GET, into the body otherwise. v2 doesn't guess; you say `query` or `body`:

```ts
// v1
class UserApi {
  @Get('/users')
  list(page: number) {
    return { page }; // GET: becomes ?page=1
  }

  @Post('/users')
  create(name: string) {
    return { name }; // POST: becomes the body
  }
}

// v2
class UserApi {
  @Get('/users')
  list(page: number) {
    return request<User[]>({ query: { page } });
  }

  @Post('/users')
  create(name: string) {
    return request<User>({ body: { name } });
  }
}
```

> **GET requests are the easiest to get wrong.** If v1's `return { page }` becomes `request({ body: { page } })`, the parameters go into the request body instead of the URL.

Path placeholders move from the second array item to `path`:

```ts
// v1
@Get('/users/:id')
get(id: number) {
  return [{}, { id }];
}

// v2
@Get('/users/:id')
get(id: number) {
  return request<User>({ path: { id } });
}
```

Every `makeBody()` field has a counterpart:

| v1 `makeBody` | v2 `request` |
| --- | --- |
| `params` | `body` |
| `query` (object or string) | `query` (object) |
| `placeholders` | `path` |
| `onProgress` | `onDownloadProgress` or `onUploadProgress` |
| `cancel` | `signal` (from an `AbortController`) |
| `jsonp` | `@JSONP({ callbackName })` on the method |

Methods can no longer be async. If a v1 method awaited something (a token, say) before returning its parameters, move that into middleware or into the function form of `@Headers`:

```ts
// v2
http.use(async (ctx, next) => {
  ctx.request.headers.authorization = `Bearer ${await getToken()}`;
  await next();
});
```

## Call results

v1 resolved to whatever the adapter returned. With v1's own axios adapter that was the whole axios response, which is why `res.data` is common in v1 code.

v2 resolves to the response body, i.e. the `data` of an axios response:

```ts
// v1
const res = await api.list(1);
console.log(res.data, res.status);

// v2
const users = await api.list(1);
console.log(users);
```

When you need the status or response headers, use `request.full<T>()`, which resolves to `{ data, status, headers }`.

## URLs and prefixes

- **`@Get(url, prefix)` no longer takes a second argument.** For another host, write an absolute URL on the method: `@Get('https://other.example.com/list')`.
- **Slashes are handled for you.** v1 concatenated strings, so `@Prefix('https://a.com')` with `@Get('list')` gave `https://a.comlist`. v2 adds the missing `/` and removes duplicates.
- **`baseURL` and `@Prefix` can be split.** Put the host that changes per environment in the client's `baseURL`, and keep only the module path, such as `/users`, in `@Prefix`.
- **Non-GET requests now send their query.** v1's axios adapter only appended the query for GET.

## Body types

v1's `@BodyType` only set the content-type and left serialization to the adapter. In v2, booze serializes the body itself, so it doesn't change when you switch adapters:

| v1 | v2 |
| --- | --- |
| `@BodyType(BodyType.Type.JSON)` | `@BodyType('json')` (the default) |
| `@BodyType(BodyType.Type.Form)` | `@BodyType('form')` |
| — | `@BodyType('multipart')`, `@BodyType('text')`, `@BodyType('raw')` |

## Hooks

v1 had five kinds of hooks; v2 has middleware. `@Before` and `@After` keep their names, but their arguments and behavior changed:

| | v1 | v2 |
| --- | --- | --- |
| `@Before` receives | The request config | The context `ctx`; the request is `ctx.request` |
| `@Before` returns `false` | The method resolves to `undefined` | The method rejects with `ABORTED` |
| `@After` receives | `(response, config)` | `(result, ctx)` |
| `@After` replaces the result | When it returns a truthy value; not awaited | When it returns anything but `undefined`; awaited |
| Written above `@Get` | Ignored | Works |

`@BeforeExecSourceFn` and the global hooks `eachBeforeExecSourceFn` and `eachAfter` are gone:

```ts
// v1
eachBeforeExecSourceFn((config) => {
  if (!isLoggedIn()) return false;
});

eachAfter((response) => {
  return response.data.data;
});

// v2
import { BoozeError, defaultClient } from 'booze';

defaultClient.use(async (ctx, next) => {
  if (!isLoggedIn()) throw new BoozeError('ABORTED', 'not logged in');
  await next();
  ctx.result = (ctx.result as { data: unknown }).data;
});
```

Note that v1's `eachAfter` received the axios response, hence `response.data.data`. In v2 middleware, `ctx.result` is already the response body, so `.data` is enough.

## JSONP

v1's `@JSONP()` only set a flag for the adapter to act on, and the bundled axios adapter never actually used JSONP. v2's `@JSONP()` comes with its own implementation, imported from a subpath:

```ts
// v2
import { Get, request } from 'booze';
import { JSONP } from 'booze/adapters/jsonp';

class SearchApi {
  @JSONP({ callbackParam: 'cb' })
  @Get('https://other.example.com/suggest')
  suggest(word: string) {
    return request<string[]>({ query: { word } });
  }
}
```

## Custom adapters

A v1 adapter was `{ name, handler(config) }`, and the method resolved to whatever `handler` returned. A v2 adapter is `{ name, send(request) }` and returns a response in a fixed shape:

```ts
// v1
const adapter = {
  name: 'my',
  handler: async (config) => {
    const res = await fetch(`${config.url}?${config.queryString}`, {
      method: config.method,
      headers: config.headers,
      body: JSON.stringify(config.params),
    });
    return res.json();
  },
};

// v2
import { BoozeError, type Adapter } from 'booze';

const adapter: Adapter = {
  name: 'my',
  async send(req) {
    let res: Response;
    try {
      res = await fetch(req.url, { method: req.method, headers: req.headers, body: req.body as BodyInit, signal: req.signal });
    } catch (cause) {
      throw new BoozeError('NETWORK_ERROR', String(cause), { cause });
    }
    const text = await res.text();
    return {
      status: res.status,
      headers: Object.fromEntries(res.headers),
      data: text ? JSON.parse(text) : undefined,
      raw: res,
    };
  },
};
```

- **The request is ready to send:** `req.url` already includes the query, `req.body` is serialized, and header names are lower-case.
- **Don't reject on non-2xx:** booze checks the status.
- **Reject with a `BoozeError`:** `NETWORK_ERROR` for network errors, `TIMEOUT` for timeouts, `ABORTED` for cancellation.

Most of the time you won't need one: v2 ships fetch, axios, xhr and jsonp adapters.

## Errors

v1 threw whatever the adapter threw, such as an `AxiosError`. v2 always throws a `BoozeError`, so your error handling doesn't change when you switch adapters:

```ts
// v1
try {
  await api.get(1);
} catch (error) {
  if (axios.isAxiosError(error)) console.log(error.response?.status);
}

// v2
import { isBoozeError } from 'booze';

try {
  await api.get(1);
} catch (error) {
  if (isBoozeError(error) && error.code === 'HTTP_ERROR') console.log(error.response?.status);
}
```

`error.response` looks much like axios's, with `status`, `headers` and `data`. For the full list of error codes, see the [readme](../readme-en.md#errors).

## What you no longer need

- **Type assertions:** `return {} as User` becomes `return request<User>()`, and the call result is a `Promise<User>` on its own.
- **`@Get` on top:** decorators can now go in any order.
- **`booze/release/commonjs`:** the package ships ESM and CommonJS, and Node and bundlers pick the right one.
