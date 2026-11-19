# booze

中文 | [English](./readme-en.md)

用 TypeScript 装饰器描述 HTTP 接口。方法只说明请求带什么参数，拼 URL、序列化、发请求和处理错误都交给 booze。

> **v2 目前是 beta 版，和 v1 不兼容。** 从 v1 升级请看[迁移指南](./docs/migration.md)。v1 的文档在 [1.x 分支](https://github.com/hiNISAL/booze/tree/1.x)。

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
const user = await api.get(1); // 类型是 User
```

## 特性

- **调用结果有类型：** `api.get(1)` 的类型就是 `Promise<User>`，不用写 `as`。
- **装饰器顺序随意：** 装饰器只记录配置，调用时才读取。写在 `@Get` 上方还是下方效果一样，同一种可以叠加，子类会继承父类的配置。
- **两种装饰器都支持：** TS 5 起默认的标准装饰器，以及 `experimentalDecorators`。tsc、esbuild、Babel、SWC 和 Vite 都测过。
- **中间件：** 鉴权、解包、重试、缓存都写成 `(ctx, next)` 形式的中间件，可以挂在客户端、类或方法上。
- **核心零依赖：** 默认用 fetch；axios、XHR、JSONP 适配器按需引入，也可以自己写。
- **ESM 和 CommonJS 都能用**，自带类型声明。

## 目录

- [安装](#安装)
- [编译配置](#编译配置)
- [定义接口](#定义接口)
- [客户端与配置](#客户端与配置)
- [中间件](#中间件)
- [取消、超时和进度](#取消超时和进度)
- [错误处理](#错误处理)
- [适配器](#适配器)
- [常见问题](#常见问题)

## 安装

```bash
npm i booze@next
```

- **运行环境：** Node.js 18 及以上，或者有 fetch 的浏览器、Deno、Bun。没有 fetch 的环境换一个[适配器](#适配器)就行。
- **TypeScript：** 5.2 及以上，默认配置就能用；开了 `experimentalDecorators` 的项目也能直接用。

## 编译配置

booze 同时支持两种装饰器，运行时会自动识别，代码写法完全一样。按你用的编译工具选一种：

| 工具 | 标准装饰器 | legacy（`experimentalDecorators`） |
| --- | --- | --- |
| tsc、tsx、esbuild | 默认 | tsconfig 里设 `"experimentalDecorators": true` |
| Vite 8、Vitest | **不支持** | tsconfig 里设 `"experimentalDecorators": true` |
| Babel | `@babel/plugin-proposal-decorators` 设 `{ version: '2023-11' }` | 同一个插件设 `{ version: 'legacy' }` |
| SWC | `jsc.transform.decoratorVersion: '2023-11'` | `jsc.transform.legacyDecorator: true` |

> **用 Vite 8 的项目一定要开 `experimentalDecorators`。** Vite 8 用 Oxc 编译 TS，Oxc 只能转换 legacy 装饰器；不开的话，`@Get` 会原样留在产物里，浏览器直接报语法错误。
>
> Vitest 只有在项目里有 `vite.config.*` 或 `vitest.config.*` 文件时才会读取 tsconfig 的这个设置。也可以在配置文件里直接写 `oxc: { decorator: { legacy: true } }`。

标准装饰器需要 `Symbol.metadata`。booze 被引入时会自动补上，不需要额外的 polyfill，也不需要 `reflect-metadata`。

## 定义接口

### HTTP 方法

| 装饰器 | 请求方法 |
| --- | --- |
| `@Get(path)` `@Post(path)` `@Put(path)` `@Delete(path)` `@Patch(path)` `@Head(path)` `@Options(path)` | 同名方法 |
| `@Request(method, path)` | 任意方法，比如 `@Request('PROPFIND', '/files')` |

被装饰的方法必须**同步返回 `request()`**。`request()` 的参数说明这次请求带什么，方法本身可以有任意参数：

```ts
class UserApi {
  @Get('/users')
  list(page = 1, keyword?: string) {
    return request<User[]>({ query: { page, keyword } });
  }
}
```

`request<T>()` 里的 `T` 就是方法 await 之后得到的类型。不写 `T` 时是 `unknown`。`T` 是你自己的声明，booze 不会校验服务端实际返回了什么，这一点和 axios、fetch 的泛型一样。

### request 的参数

都是可选的：

| 字段 | 说明 |
| --- | --- |
| `path` | 替换路径里的 `:name` 占位符 |
| `query` | 拼到 URL 上，所有请求方法都会拼 |
| `body` | 请求体，按 [`@BodyType`](#请求体) 序列化 |
| `headers` | 只作用于这一次请求，优先级最高 |
| `signal` | 用 `AbortSignal` 取消请求 |
| `timeout` | 超时毫秒数，覆盖其他地方设置的超时 |
| `responseType` | `'json'`（默认）、`'text'`、`'blob'`、`'arrayBuffer'` |
| `onUploadProgress` / `onDownloadProgress` | 进度回调，是否支持取决于[适配器](#适配器) |
| `meta` | 传给中间件的自定义数据，booze 自己不读 |

### URL 拼接

最终的 URL 由三段拼成：客户端的 `baseURL`、类上的 `@Prefix`、方法上的 path。booze 会处理好中间的 `/`。任何一段是绝对地址（`https://…` 或 `//…`）时，它前面的部分都会被丢掉。

| `baseURL` | `@Prefix` | 方法上的 path | 结果 |
| --- | --- | --- | --- |
| `https://api.com` | `/users` | `/:id` | `https://api.com/users/1` |
| `https://api.com/v1/` | `users` | `list` | `https://api.com/v1/users/list` |
| `https://api.com` | `https://other.com` | `/x` | `https://other.com/x` |
| `https://api.com` | `/users` | `https://cdn.com/x` | `https://cdn.com/x` |

- **路径占位符：** `:name` 用 `path.name` 替换，值会经过 `encodeURIComponent`。值为 `0` 时也会正常替换；缺少值时抛出 `MISSING_PATH_PARAM`。只替换路径部分，`http://localhost:8080` 里的端口不会被当成占位符。
- **query：** 数组会重复键名（`a=1&a=2`），嵌套对象用方括号（`b[c]=2`），`Date` 转成 ISO 字符串，`undefined` 的键会被忽略，`null` 变成空值（`a=`）。需要别的格式时，给客户端传 `serializeQuery`，比如 `qs.stringify`。

### 请求体

普通对象按 `@BodyType` 序列化，默认是 JSON：

| BodyType | 发送的内容 | content-type |
| --- | --- | --- |
| `'json'`（默认） | `JSON.stringify(body)` | `application/json` |
| `'form'` | `a=1&b=2`，规则和 query 相同 | `application/x-www-form-urlencoded` |
| `'multipart'` | `FormData` | 由平台生成（带 boundary） |
| `'text'` | `String(body)` | `text/plain;charset=UTF-8` |
| `'raw'` | 原样发送 | 不设置 |

```ts
class LoginApi {
  @BodyType('form')
  @Post('/login')
  login(username: string, password: string) {
    return request<{ token: string }>({ body: { username, password } });
  }
}
```

- **原生类型原样发送：** `FormData`、`Blob`、`File`、`URLSearchParams`、`ArrayBuffer`、TypedArray、`ReadableStream` 和字符串不经过序列化，booze 也不会给它们设置 content-type。注意：自己 `JSON.stringify` 出来的字符串也属于这一类，需要的话请自己设置 content-type。
- **不会覆盖你设置的 content-type：** 任何一层设置过 `content-type`，booze 都不会改。

### 静态方法

静态方法也可以装饰，`this` 指向类本身：

```ts
class StatusApi {
  @Get('https://status.example.com/ping')
  static ping() {
    return request<{ ok: boolean }>();
  }
}

await StatusApi.ping();
```

### 类型

- **调用结果：** 类型是 `BoozeRequest<T>`。它继承自 `Promise<T>`，可以直接赋给 `Promise<T>`，也可以 `.then`、`.catch`。
- **声明返回类型：** 想在方法签名上写清楚返回什么，可以这样写，`request()` 会自动推断出 `T`：

  ```ts
  @Get('/users')
  list(page: number): BoozeRequest<User[]> {
    return request({ query: { page } });
  }
  ```

- **编译期就会报错的写法：** 方法返回普通对象，或者方法是 `async` 的。原因见[常见问题](#为什么方法不能是-async-的)。

## 客户端与配置

### 客户端

客户端保存全局配置和中间件。没有用 `@Client` 的类都走默认客户端，用 `configure()` 修改它的配置：

```ts
import { configure } from 'booze';

configure({ baseURL: 'https://api.example.com', timeout: 10_000 });
```

需要多套配置（比如两个服务、两种鉴权方式）时，用 `createClient()` 创建客户端，再用 `@Client` 指定给类：

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

`createClient()` 的选项：

| 选项 | 说明 |
| --- | --- |
| `baseURL` | URL 的第一段 |
| `headers` | 每个请求都带的请求头 |
| `bodyType` | 默认的请求体类型，不设时是 `'json'` |
| `timeout` | 超时毫秒数 |
| `adapter` | 发请求用的适配器，不设时用内置的 fetch 适配器 |
| `validateStatus` | 哪些状态码算成功，默认是 2xx；其他状态码抛 `HTTP_ERROR` |
| `serializeQuery` | 替换默认的 query 序列化函数，`'form'` 请求体也会用它 |

客户端的配置在每次请求时才读取，所以类定义之后再调用 `client.configure()`、`configure()` 或 `client.use()` 也会生效。`configure()` 会合并 `headers`，其他选项直接替换。

### 配置的优先级

同一项配置可以写在四个地方。优先级从高到低是：单次调用、方法、类、客户端。

| 配置 | 客户端 | 类 | 方法 | 单次调用 `request({...})` | 合并方式 |
| --- | --- | --- | --- | --- | --- |
| 地址 | `baseURL` | `@Prefix` | `@Get(path)` 等 | `path` 填占位符 | 依次拼接 |
| 请求头 | `headers` | `@Headers` | `@Headers` | `headers` | 合并，键名统一转成小写 |
| 请求体类型 | `bodyType` | `@BodyType` | `@BodyType` | — | 覆盖 |
| 超时 | `timeout` | `@Timeout` | `@Timeout` | `timeout` | 覆盖 |
| 适配器 | `adapter` | `@Adapter` | `@Adapter` | — | 覆盖 |
| 中间件 | `use()` | `@Use` 等 | `@Use` 等 | — | 叠加，见[执行顺序](#执行顺序) |

`@Headers`、`@BodyType`、`@Timeout`、`@Adapter`、`@Use`、`@Before`、`@After` 都可以写在类上或方法上。写在类上时，对类里所有方法生效，包括继承来的方法。

### @Headers

有三种写法，同一个地方可以写多个：

```ts
@Headers({ 'x-module': 'user' })
@Headers('x-version', '2')
@Headers(async (ctx) => ({ authorization: `Bearer ${await getToken()}` }))
class UserApi {}
```

函数形式会收到请求的上下文 `ctx`（见[中间件](#中间件)），可以是 async 的。同一个地方的多个 `@Headers` 设置了同一个键时，写在上方的生效。

### 继承

子类继承父类的全部配置。子类的 `@Prefix` 会替换父类的，对继承来的方法也生效：

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

await new UserApiV2().get(1); // GET /v2/users/1，同样带 x-module
```

## 中间件

中间件是一个 `(ctx, next) => unknown` 函数。调用 `await next()` 之前可以修改请求，之后可以读取或替换结果：

```ts
import type { Middleware } from 'booze';

const timing: Middleware = async (ctx, next) => {
  const start = Date.now();
  await next();
  console.log(ctx.request.method, ctx.request.url, Date.now() - start, 'ms');
};
```

中间件可以挂在三个地方：

```ts
http.use(timing);            // 客户端：这个客户端的所有请求

@Use(timing)                 // 类：类里的所有方法
class UserApi {
  @Use(timing)               // 方法：只有这个方法
  @Get('/:id')
  get(id: number) {
    return request<User>({ path: { id } });
  }
}
```

### ctx

| 字段 | 说明 |
| --- | --- |
| `ctx.request` | 将要发出的请求：`method`、`url`（不含 query）、`query`、`headers`（键名小写）、`body`、`bodyType`、`timeout`、`signal`、`responseType`、`meta`。可以直接修改 |
| `ctx.response` | `next()` 之后才有：`status`、`headers`（键名小写）、`data`（已解析）、`raw`（适配器的原始响应） |
| `ctx.result` | 方法最终 resolve 的值，默认是 `ctx.response.data`，可以替换 |
| `ctx.client` | 这次请求用的客户端 |
| `ctx.instance` | 方法的 `this`：实例，静态方法里是类本身 |
| `ctx.name` / `ctx.args` | 方法名和调用参数 |

### 常见用法

**鉴权：** 取 token 这类异步准备工作都放在中间件里。

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

**统一解包：** 服务端返回 `{ code, data, msg }` 时，在中间件里取出 `data`。方法上的 `request<T>()` 写解包之后的类型。

```ts
http.use(async (ctx, next) => {
  await next();
  const body = ctx.result as { code: number; data: unknown; msg: string };
  if (body.code !== 0) throw new Error(body.msg);
  ctx.result = body.data;
});
```

**缓存：** 不调用 `next()` 就不会发请求。这时必须设置 `ctx.result`，否则方法会以 `ABORTED` 失败。

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

**重试：** `booze/middleware` 提供了 `retry()`。

```ts
import { retry } from 'booze/middleware';

http.use(retry({ retries: 3 }));
```

| 选项 | 默认值 |
| --- | --- |
| `retries` | `2`，不含第一次请求 |
| `delay` | 第 n 次重试前等待 `300 × 2^(n-1)` 毫秒；可以传数字或 `(attempt, error) => number`。响应头里有数字形式的 `Retry-After` 时以它为准 |
| `methods` | `GET`、`HEAD`、`OPTIONS`、`PUT`、`DELETE` 这些幂等方法 |
| `statuses` | `408`、`429`、`500`、`502`、`503`、`504` |
| `when` | `(error, ctx) => boolean`，替换默认的判断 |

默认会重试网络错误、超时和上面这些状态码。被取消的请求不会重试，等待重试期间也可以取消。`retry()` 只重复它里面的中间件和请求，所以要让鉴权中间件每次重试都重新取 token，就把 `retry()` 注册在鉴权中间件之前。

### @Before 和 @After

`@Before` 和 `@After` 是两种常用中间件的简写：

```ts
@Before((ctx) => ctx.request.method !== 'DELETE' || confirm('确定删除？'))
@After((result, ctx) => {
  console.log(ctx.name, result);
})
class UserApi {}
```

- **`@Before(fn)`：** 请求前执行，可以是 async 的。返回 `false` 时不发请求，方法以 `ABORTED` 失败。
- **`@After(fn)`：** 请求成功后执行，可以是 async 的。返回值不是 `undefined` 时，会替换方法的结果。

### 执行顺序

中间件按洋葱模型执行，从外到内依次是：客户端 → 父类 → 子类 → 方法。

- **同一个地方的多个装饰器：** 写在上方的在外层。`@Use(a, b)` 里 `a` 在外层。
- **`client.use()`：** 先注册的在外层。
- **`next()` 可以多次调用：** 每次都会重新执行内层的中间件并重新发请求，`retry()` 就是这样实现的。

```ts
const log = (name: string): Middleware => async (_ctx, next) => {
  console.log('进入', name);
  await next();
  console.log('离开', name);
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

// 进入：client → class → a → b → 发请求
// 离开：b → a → class → client
```

### request.full

方法默认只返回结果。需要状态码或响应头时，用 `request.full<T>()`：

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

`data` 和 `request<T>()` 得到的结果一样，也是经过中间件处理之后的。如果中间件没发请求就给出了结果（比如缓存命中），`status` 是 `200`，`headers` 是空对象。

## 取消、超时和进度

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
controller.abort(); // file 以 ABORTED 失败
```

- **取消：** 传 `signal`。取消后方法以 `ABORTED` 失败。
- **超时：** 用 `timeout`、`@Timeout(ms)` 或客户端的 `timeout`，单位是毫秒。超时后方法以 `TIMEOUT` 失败。
- **进度：** 回调收到 `{ loaded, total? }`。fetch 适配器只支持下载进度；需要上传进度时用 xhr 或 axios 适配器。

## 错误处理

方法失败时抛出 `BoozeError`，用 `code` 区分原因：

| code | 什么时候出现 |
| --- | --- |
| `HTTP_ERROR` | 状态码没通过 `validateStatus`（默认非 2xx） |
| `NETWORK_ERROR` | 网络错误，或适配器抛了非 `BoozeError` 的错误 |
| `TIMEOUT` | 超时 |
| `ABORTED` | `signal` 被取消；`@Before` 返回 `false`；中间件没调用 `next()` 也没设置 `ctx.result` |
| `MISSING_PATH_PARAM` | 路径占位符没有对应的值 |
| `NO_ADAPTER` | 没有可用的适配器，比如环境里没有 fetch |
| `INVALID_RETURN` | 方法没有同步返回 `request()` |
| `NOT_DECORATED` | 方法没加 HTTP 方法装饰器，却直接 await 了 `request()` 的返回值 |

错误对象上还有 `ctx`（请求上下文）；收到过响应时还有 `response`：

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

中间件里抛出的其他错误会原样传给调用方。

## 适配器

适配器负责真正发出请求。默认用内置的 fetch 适配器，其他适配器从子路径引入：

| 适配器 | 引入 | 上传进度 | 下载进度 | 说明 |
| --- | --- | --- | --- | --- |
| `fetchAdapter(options?)` | `booze` | — | 支持 | 默认。`options.fetch` 替换 fetch 函数，`options.init` 传额外的 fetch 选项（比如 `credentials`） |
| `axiosAdapter(instance?)` | `booze/adapters/axios` | 支持 | 支持 | 需要另外安装 axios。可以传 `axios.create()` 创建的实例 |
| `xhrAdapter(options?)` | `booze/adapters/xhr` | 支持 | 支持 | 仅浏览器。`options.withCredentials` 让跨域请求带 cookie |
| `jsonpAdapter(options?)` | `booze/adapters/jsonp` | — | — | 仅浏览器，只支持 GET。`@JSONP(options)` 是 `@Adapter(jsonpAdapter(options))` 的简写 |

适配器可以设在客户端、类或方法上：

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

### 自定义适配器

适配器是一个有 `name` 和 `send()` 的对象。`send()` 收到的请求已经处理好了：URL 里拼好了 query，body 已经序列化，请求头的键名都是小写。

```ts
interface Adapter {
  name: string;
  send(request: AdapterRequest): Promise<BoozeResponse>;
}
```

写适配器时要遵守两条约定：

- **非 2xx 状态码不要抛错：** 正常返回响应，状态码由 booze 统一用 `validateStatus` 判断。
- **失败时抛 `BoozeError`：** 网络错误用 `NETWORK_ERROR`，超时用 `TIMEOUT`，取消用 `ABORTED`。抛出其他错误时，booze 会把它包装成 `NETWORK_ERROR`。

比如在微信小程序里用 `wx.request`：

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

## 常见问题

### 为什么方法不能是 async 的？

async 方法返回的是普通的 `Promise`，booze 和 TypeScript 都分不清它装的是请求描述还是别的东西。所以 async 方法会在编译期报错，在 JS 里运行时会抛 `INVALID_RETURN`。取 token、签名这类异步准备工作，请放进[中间件](#常见用法)或 `@Headers` 的函数形式里。

### 直接 await `request()` 为什么会报 `NOT_DECORATED`？

`request()` 本身不发请求，它只是交给装饰器的一份描述。方法没加 `@Get` 这类装饰器时，await 它就会得到这个错误。

### Vite 项目里浏览器报语法错误

多半是 `@` 装饰器没被转换。见[编译配置](#编译配置)：Vite 8 需要在 tsconfig 里开 `experimentalDecorators`。

### 同一个方法能写两个 HTTP 方法装饰器吗？

不能。写了两个时，类定义阶段就会报错。

## 开发

```bash
pnpm install
pnpm test        # 单元测试、端到端测试和编译矩阵，两种装饰器模式各跑一遍
pnpm typecheck
pnpm build
```

## License

MIT
