# booze

🇨🇳[中文](https://github.com/hiNISAL/booze#booze) | [ENGLISH](https://github.com/hiNISAL/booze/blob/main/readme-en.md)

Booze is a client-side HTTP application framework that allows developers to describe requests as the core of their code.

It does not provide the ability to make requests itself, but instead collects request information and passes it on to a request engine through an adapter, making it compatible with all request solutions.

## INSTALL

```shell
npm i booze -S
```

## USAGE

```ts
import { Prefix, Get, regAdapter } from 'booze';
import axiosAdapter from 'booze/adapter/axios';

// register an adapter, use axios make request
regAdapter(axiosAdapter);

// set server site domain
@Prefix('https://some.site.com')
class Request {
  // request by GET HTTP method, target is `/list`
  // decorator by `Get`, it will rewire the `getList` method.
  @Get('/list')
  public getList(page: number) {
    // return value will be handled by `booze`, it will be request params
    // then `booze` will pipe to axios adapter, adapter will return response
    return {
      page,
    };
  }
}

const service = new Request();

// call the method, it will make an request
const result = await service.getList(1);

// response from server
console.log(result);
```

## HOW IT WORKS


booze provides decorators such as Get and Post, which can be used to decorate class methods and override them.

The original methods are internally preserved and called each time the decorated method is called. The return value of the original method is used as the request parameter and passed to the adapter for processing. The adapter returns the processed content.

## ADAPTER

booze does not include any request-related capabilities and is only responsible for collecting information related to requests.

The role of the adapter is to make requests based on this configuration, making booze compatible with all request solutions. However, in specific scenarios, it may not be ready to use right out of the box.

```ts
// request information
interface BoozeRequestConfig {
  url: string;
  method: RequestMethod;
  queryString: string;
  query: Record<string, string>;
  params: Record<string, any>;
  headers: Record<string, string>;
  jsonp: string|null;
  onProgress: Function|null;
  cancel: Function|null;
  _prefix: string;
  _url: string;
}
```

`booze` is not out of the box.

adapter is an object, includes `name` prop and `handler` method.

```ts
const adapter = {
  // adapter's name
  name: 'adapter name',
  // adapter handler
  // get the request information, and make a request, then return the response
  handler: async (config) => {
    console.log(config.url);

    const result = await axios.get(...);

    return result;
  },
};
```

### REGISTER ADAPTER

`booze` presets some adapter, its not prefect, but do not worry, thats easy, you can extend it by self.

```ts
import { regAdapter } from 'booze';
import axiosAdapter from 'booze/adapter/axios';

// register adapter globally
regAdapter(axiosAdapter);
```

## Decorators

### Prefix

set all request url prefix.

to decorate a class, when booze create a request, it will be request url prefix
```ts
@Prefix('https://some.site.com')
class Req {}
```

#### Get

decorate a method, return value will be query string, and use `Get` method.

```ts
@Prefix('https://some.site.com')
class Req {
  @Get('/list')
  public getList() {
    return {
      page: 1,
    };
  }
}
```

the second argument will replace `Prefix` decorator's value, be the request url prefix.

```ts
@Prefix('https://some.site.com')
class Req {
  @Get('/list', '//site.com')
  public getList() {
    return {
      page: 1,
    };
  }
}
```

in some scene, the params is in url, it can solute by `placeholder`.

used `:placeholder` to create placeholder in path, then return value should be Array type, the second unit will be placeholder value, `booze` will replace it when collect request information.

```ts
@Prefix('https://some.site.com')
class Req {
  // placeholder is `:id`
  @Get('/list/:id')
  public getList() {
    return [{
      page: 1,
    }, {
      // will replace `:id`, path will changed be `/list/996`
      id: 996,
    }];
  }
}
```

**HTTP method decorator(Get/Post/Delete...) need put at the first**

#### Post

decorate a method, return value will be query string, and use `Post` method.

```ts
@Prefix('https://some.site.com')
class Req {
  @Post('/')
  public updateSomeThing() {
    return {};
  }
}
```

#### Headers

set request headers.

```ts
// case 1
class Req {
  @Post('/')
  @Headers('Authorization', 'Bearer .......')
  public updateSomeThing() {
    return {};
  }
}

// case2
class Req {
  @Post('/')
  @Headers({
    Authorization: 'Bearer .......',
    ContentType: 'application/json',
  })
  public updateSomeThing() {
    return {};
  }
}

// case3
class Req {
  @Post('/')
  @Headers((config: BoozeRequestConfig) => {
    return {};
  })
  public updateSomeThing() {
    return {};
  }
}

@Prefix('')
// like upper case
@Headers(...)
class Req {}
```

#### JSONP

set the request config `method` prop to `JSONP`.

```ts
@Prefix('https://some.site.com')
class Req {
  @Get('/list')
  @JSONP()
  public getList() {
    return {
      page: 1,
    };
  }
}
```

#### Before

it will called before request send.

if return value is `false`, request will be beak.

when decorate a class, will called before each request send.

```ts
@Prefix('https://some.site.com')
@Before((config: BoozeRequestConfig) => {

})
class Req {
  @Get('/list')
  @JSONP()
  @Before((config: BoozeRequestConfig) => {

  })
  public getList() {
    return {
      page: 1,
    };
  }
}
```

#### After

it will called after request be response.

when decorate a class, will called after each request be response.

```ts
@Prefix('https://some.site.com')
@After<ResponseType>((response, config: BoozeRequestConfig) => {

})
class Req {
  @Get('/list')
  @JSONP()
  @After<ResponseType>((response, config: BoozeRequestConfig) => {

  })
  public getList() {
    return {
      page: 1,
    };
  }
}
```

#### Adapter

set the adapter for some request.

```ts
@Prefix('https://some.site.com')
class Req {
  @Get('/list')
  @Adapter(axiosAdapter)
  public getList() {
    return {
      page: 1,
    };
  }
}
```

also can given a string, `booze` will find adapter from registered adapters by `name` prop.

```ts
@Prefix('https://some.site.com')
class Req {
  @Get('/list')
  @Adapter('jqueryAdapter')
  public getList() {
    return {
      page: 1,
    };
  }
}
```

#### BeforeExecSourceFn

it called before saved call saved method, if return value is false, request will be break.

```ts
@Prefix('https://some.site.com')
@BeforeExecSourceFn(() => {})
class Req {
  @Delete('/')
  @BeforeExecSourceFn(() => {})
  public updateSomeThing() {}
}
```

#### BodyType

`content-type` presets:

- BodyType.Type.Form - application/x-www-form-urlencoded
- BodyType.Type.JSON - application/json

```ts
import { BodyType } from 'booze';

@Prefix('https://some.site.com')
@BodyType(BodyType.Type.Form)
class Req {
  @Delete('/')
  @BodyType(BodyType.Type.JSON)
  public updateSomeThing() {}
}
```

#### Delete

```ts
@Prefix('https://some.site.com')
class Req {
  @Delete('/')
  public updateSomeThing() {}
}
```

#### Put

```ts
@Prefix('https://some.site.com')
class Req {
  @Put('/')
  public updateSomeThing() {}
}
```

#### Options

```ts
@Prefix('https://some.site.com')
class Options {
  @Put('/')
  public updateSomeThing() {}
}
```

#### Head

```ts
@Prefix('https://some.site.com')
class Options {
  @Head('/')
  public updateSomeThing() {}
}
```

#### Patch

```ts
@Prefix('https://some.site.com')
class Patch {
  @Head('/')
  public updateSomeThing() {}
}
```

### APIs

#### regAdapter

register an adapter.

can register more than one, the first is default.

can toggle adapter by `setAdapter`.

```ts
import { regAdapter } from 'booze';

// register one
regAdapter(axiosAdapter);
// register many
regAdapter([
  jqueryAdapter,
  fetchAdapter,
  {
    name: 'xhrAdapter',
    handler: (config) => {
      return {};
    },
  },
]);
```

#### setAdapter

set an adapter.

can toggle by adapter `name`, or given a new adapter.

```ts
import { setAdapter } from 'booze';

setAdapter('xhrAdapter');

setAdapter({
  name: '',
  handler: () => {},
});
```

#### makeBody

some special case, like cancel request, show progress and more, can call `makeBody` method to help booze decide request information.

```ts
@Prefix('https://some.site.com')
class Req {
  @Get('/list')
  public getList() {
    return makeBody({
      // body params
      params: {},
      // query string
      query: {},
      // placeholder params
      placeholder: {},
      // progress handler
      onProgress: () => {},
      // cancel handler
      cancel: () => {},
      // jsonp callback function name
      jsonp: '',
    });
  }
}
```

#### eachBeforeExecSourceFn

register hook globally, it called before saved method

if return value is `false`, the request will be break.

```ts
import { eachBeforeExecSourceFn } from 'booze';

eachBeforeExecSourceFn((baseConfig) => {
  console.log(baseConfig);
});
```

#### eachAfter

register hook globally, it called after each request(after adapter called).

```ts
import { eachAfter } from 'booze';

eachAfter((response, baseConfig) => {
  console.log(baseConfig);
});
```

## SOME TIP

### response signature

the class method will rewrite by booze decorators, so typescript will assert type fail.

thats problem has no good way to solute, there is [ISSUE](https://github.com/microsoft/TypeScript/issues/49229) about this problem.

you can use `as` keyword, to set the type by explicit.

```ts
interface SomeInterface {

}

@Prefix('https://some.site.com')
class Req {
  @Get('/')
  public getSomeThing() {
    return {} as SomeInterface;
  }
}
```

### the decorators order

the decorator hat set the http method, should be at the first line.

includes:

- @Get
- @Post
- @Delete
- @Put
- @Patch
- @Options
- @Head

```ts
@Prefix('https://some.site.com')
class Req {
  // this wrong, will throw error
  @After()
  @Get('/')
  public getSomeThing() {
    return {};
  }
}

@Prefix('https://some.site.com')
class Req {
  // bingo~
  @Get('/')
  @After()
  public getSomeThing() {
    return {};
  }
}
```

### cannot work in JavaScript

the `main` prop in package.json is `src/index.ts`, so if want work in js, need import tsc compiled:

```js
import { Get, Prefix } from 'booze/release/commonjs';
```
