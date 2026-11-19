# 从 v1 迁移到 v2

中文 | [English](./migration-en.md)

v2 是重写的版本，API 不兼容 v1。改动的核心是：**方法返回 `request<T>()`，不再返回请求参数**。这样调用结果才有正确的类型，装饰器的书写顺序也不再有影响。

v1 的代码和文档保留在 [1.x 分支](https://github.com/hiNISAL/booze/tree/1.x)。

## 步骤

1. 升级：`npm i booze@next`。删掉 `booze/release/commonjs` 这类引入路径，统一从 `booze` 引入。tsconfig 不用改：v1 要求开 `experimentalDecorators`，v2 开不开都能用（用 Vite 8 的项目要保持开启，见 [readme](../readme.md#编译配置)）。
2. 把 `regAdapter` / `setAdapter` 换成 `configure()` 或 `createClient()`，见[适配器](#适配器)。
3. 把每个方法的返回值改成 `request<T>({...})`，见[方法返回值](#方法返回值)。GET 请求要特别注意。
4. 检查用到返回结果的地方：v1 配合 axios 适配器时拿到的是整个 axios 响应，v2 拿到的是响应体，见[调用结果](#调用结果)。
5. 把钩子改成中间件，见[钩子](#钩子)。
6. 检查错误处理，见[错误处理](#错误处理)。
7. 删掉为了类型写的 `as`，以及为了顺序把 `@Get` 挪到最上面的写法，这些都不再需要了。

## 对照表

| v1 | v2 |
| --- | --- |
| `import ... from 'booze/release/commonjs'` | `import ... from 'booze'` |
| `regAdapter(axiosAdapter)` | `configure({ adapter: axiosAdapter() })` |
| `setAdapter('name')` / `setAdapter(adapter)` | `configure({ adapter })`，或者用 `createClient()` 创建多个客户端 |
| `import axiosAdapter from 'booze/adapter/axios'` | `import { axiosAdapter } from 'booze/adapters/axios'` |
| `@Adapter('name')` | `@Adapter(adapter)`，直接传适配器对象 |
| 适配器 `{ name, handler(config) }` | `{ name, send(request) }`，见[自定义适配器](#自定义适配器) |
| `@Get(url, prefix)` | `@Get(url)`；要换域名就写绝对 URL |
| GET：`return { page }` | `return request<T>({ query: { page } })` |
| POST 等：`return { name }` | `return request<T>({ body: { name } })` |
| `return [params, placeholders]` | `return request<T>({ query 或 body, path: placeholders })` |
| `makeBody({ params, query, placeholders, onProgress, cancel, jsonp })` | `request({ body, query, path, onDownloadProgress / onUploadProgress, signal })`；JSONP 用 `@JSONP()` |
| `return {} as User` | `return request<User>()` |
| `@BodyType(BodyType.Type.JSON)` | `@BodyType('json')`，默认就是 json，可以不写 |
| `@BodyType(BodyType.Type.Form)` | `@BodyType('form')` |
| `@Headers((config) => headers)` | `@Headers((ctx) => headers)`，可以是 async 的 |
| `@Before((config) => ...)` | `@Before((ctx) => ...)` |
| `@After((response, config) => ...)` | `@After((result, ctx) => ...)` |
| `@BeforeExecSourceFn(fn)` | `@Before(fn)` 或 `@Use(middleware)` |
| `eachBeforeExecSourceFn(fn)` | `defaultClient.use(middleware)` 或 `client.use(middleware)` |
| `eachAfter(fn)` | `defaultClient.use(middleware)` 或 `client.use(middleware)` |
| `@JSONP()`（需要适配器自己支持） | `import { JSONP } from 'booze/adapters/jsonp'`，`@JSONP()` 直接可用 |

## 适配器

v1 用全局注册的方式选择适配器：

```ts
// v1
import { regAdapter } from 'booze';
import axiosAdapter from 'booze/adapter/axios';

regAdapter(axiosAdapter);
```

v2 默认就用 fetch，不需要注册。想继续用 axios：

```ts
// v2
import { configure } from 'booze';
import { axiosAdapter } from 'booze/adapters/axios';

configure({ adapter: axiosAdapter() });
```

axios 需要你自己安装。已经有配置好的 axios 实例时，可以传进去：`axiosAdapter(instance)`。

v1 用 `setAdapter('name')` 在多个适配器之间切换。v2 改成创建多个客户端，用 `@Client` 指定给类；单个类或方法也可以用 `@Adapter(adapter)` 指定：

```ts
// v2
import { Client, createClient } from 'booze';
import { xhrAdapter } from 'booze/adapters/xhr';

const legacy = createClient({ baseURL: 'https://old.example.com', adapter: xhrAdapter() });

@Client(legacy)
class OldApi {}
```

## 方法返回值

v1 的方法直接返回请求参数，booze 按请求方法决定参数放在哪里：GET 放进 query，其他方法放进 body。v2 不再猜测，你要明确写出 `query` 还是 `body`：

```ts
// v1
class UserApi {
  @Get('/users')
  list(page: number) {
    return { page }; // GET：自动变成 ?page=1
  }

  @Post('/users')
  create(name: string) {
    return { name }; // POST：自动变成 body
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

> **GET 请求最容易漏改。** 如果把 v1 的 `return { page }` 改成 `request({ body: { page } })`，参数会被当作请求体，而不是拼到 URL 上。

路径占位符从数组的第二项改成 `path`：

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

`makeBody()` 的字段都有对应的写法：

| v1 `makeBody` | v2 `request` |
| --- | --- |
| `params` | `body` |
| `query`（对象或字符串） | `query`（对象） |
| `placeholders` | `path` |
| `onProgress` | `onDownloadProgress` 或 `onUploadProgress` |
| `cancel` | `signal`（`AbortController` 的 signal） |
| `jsonp` | 方法上加 `@JSONP({ callbackName })` |

方法不能再是 async 的。v1 的方法如果先 await 了一些东西（比如取 token）再返回参数，请把这部分移到中间件或 `@Headers` 的函数形式里：

```ts
// v2
http.use(async (ctx, next) => {
  ctx.request.headers.authorization = `Bearer ${await getToken()}`;
  await next();
});
```

## 调用结果

v1 返回的是适配器返回的东西。用 v1 自带的 axios 适配器时，那就是整个 axios 响应，所以代码里常见 `res.data`。

v2 默认返回响应体，也就是 axios 响应里的 `data`：

```ts
// v1
const res = await api.list(1);
console.log(res.data, res.status);

// v2
const users = await api.list(1);
console.log(users);
```

需要状态码或响应头时，用 `request.full<T>()`，它返回 `{ data, status, headers }`。

## URL 和前缀

- **`@Get(url, prefix)` 的第二个参数没有了。** 要访问其他域名，直接在方法上写绝对 URL：`@Get('https://other.example.com/list')`。
- **`/` 会自动处理。** v1 直接拼接字符串，`@Prefix('https://a.com')` 加 `@Get('list')` 会得到 `https://a.comlist`。v2 会补上中间的 `/`，也会去掉重复的 `/`。
- **`baseURL` 和 `@Prefix` 可以分开写。** 推荐把随环境变化的域名放在客户端的 `baseURL` 里，`@Prefix` 只写模块路径，比如 `/users`。
- **非 GET 请求的 query 现在会发出去。** v1 的 axios 适配器只给 GET 拼 query。

## 请求体类型

v1 的 `@BodyType` 只设置 content-type，序列化交给适配器。v2 的 `@BodyType` 由 booze 自己序列化，换适配器也不会变：

| v1 | v2 |
| --- | --- |
| `@BodyType(BodyType.Type.JSON)` | `@BodyType('json')`（默认值） |
| `@BodyType(BodyType.Type.Form)` | `@BodyType('form')` |
| — | `@BodyType('multipart')`、`@BodyType('text')`、`@BodyType('raw')` |

## 钩子

v1 有五套钩子，v2 统一成中间件。`@Before` 和 `@After` 保留了名字，但参数和行为都变了：

| | v1 | v2 |
| --- | --- | --- |
| `@Before` 的参数 | 请求配置 `config` | 上下文 `ctx`，请求在 `ctx.request` 里 |
| `@Before` 返回 `false` | 方法 resolve `undefined` | 方法以 `ABORTED` 失败 |
| `@After` 的参数 | `(response, config)` | `(result, ctx)` |
| `@After` 替换结果 | 返回真值时替换，不会被 await | 返回值不是 `undefined` 就替换，会被 await |
| 写在 `@Get` 上方 | 不生效 | 生效 |

`@BeforeExecSourceFn` 和两个全局钩子 `eachBeforeExecSourceFn`、`eachAfter` 都删掉了：

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

注意：v1 里 `eachAfter` 拿到的是 axios 响应，所以要 `response.data.data`；v2 中间件里的 `ctx.result` 已经是响应体，只需要 `.data`。

## JSONP

v1 的 `@JSONP()` 只是打一个标记，要靠适配器自己实现，而自带的 axios 适配器实际上从来没有走过 JSONP。v2 的 `@JSONP()` 自带实现，从子路径引入：

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

## 自定义适配器

v1 的适配器是 `{ name, handler(config) }`，`handler` 返回什么，方法就 resolve 什么。v2 改成 `{ name, send(request) }`，返回统一格式的响应：

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

- **请求已经处理好了：** `req.url` 已经拼好 query，`req.body` 已经序列化，请求头的键名是小写。
- **非 2xx 不要抛错：** 状态码由 booze 统一判断。
- **失败时抛 `BoozeError`：** 网络错误用 `NETWORK_ERROR`，超时用 `TIMEOUT`，取消用 `ABORTED`。

大多数情况下不需要自己写：v2 自带 fetch、axios、xhr 和 jsonp 四个适配器。

## 错误处理

v1 抛出的是适配器自己的错误，比如 `AxiosError`。v2 统一抛 `BoozeError`，换适配器时错误处理代码不用改：

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

`error.response` 的格式和 axios 类似，也有 `status`、`headers`、`data`。错误码的完整列表见 [readme](../readme.md#错误处理)。

## 不用再写的东西

- **类型断言：** `return {} as User` 改成 `return request<User>()`，调用结果自动就是 `Promise<User>`。
- **`@Get` 必须放在最上面：** 现在装饰器可以按任意顺序写。
- **`booze/release/commonjs`：** 包里同时有 ESM 和 CommonJS，Node 和打包工具会自动选择。
