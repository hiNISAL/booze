# booze

> 项目构建中...
> API变化频繁...

booze是一个客户端HTTP上层应用框架，使客户端请求代码编写核心为描述一个请求。

booze不提供请求的能力，只收集请求信息，通过一个适配器递交给底层的请求引擎，所以兼容所有请求方案。

## 安装

```shell
npm i booze -S
```

## 使用

```ts
import { Prefix, Get, regAdapter } from 'booze';
import axiosAdapter from 'booze/adapter/axios';

// 注册适配器 使用axios为底层请求框架
regAdapter(axiosAdapter);

// 设置服务域名
@Prefix('https://some.site.com')
class Request {
  // 表示为一个get请求，接口为/list
  // 被Get装饰后，方法内容会被改写
  @Get('/list')
  public getList(page: number) {
    // 返回值被booze处理后会作为一部分参数，递交给axios，返回值就是服务端响应的内容
    return {
      page,
    };
  }
}

const service = new Request();

// 调用方法，会发起一个请求
const result = await service.getList(1);

// 请求响应的数据
console.log(result);
```

## 核心原理

`booze`提供了一些装饰器，如`Get`、`Post`，这些装饰器装饰类的方法后，会对方法进行重写。

重写前的方法会被内部保留，每次调用被装饰过的方法后，内部会调用原方法，得到返回值作为请求参数，然后递交适配器处理后，返回适配器处理后的内容。

## 适配器

`booze` 不包含任何请求相关的能力，仅负责收集请求相关的信息。

`适配器`的作用就是根据这些配置去发起请求，所以`booze`兼容所有请求方案，但在特殊场景下并非开箱即用。

适配器本质是一个对象，包含`name`属性和`handler`方法。

```ts
const adapter = {
  // 适配器名称
  name: 'adapter name',
  // 适配器处理函数
  // 接收收集的请求数据，在这里调用真正的请求方法，然后返回
  handler: async (config) => {
    console.log(config.url);

    const result = await axios.get(...);

    return result;
  },
};
```

### 注册适配器

booze 内置了部分适配器，提供的能力不一定完善，可以自行扩展。

```ts
import { regAdapter } from 'booze';
import axiosAdapter from 'booze/adapter/axios';

// 全局注册适配器
regAdapter(axiosAdapter);
```

## Decorators

### Prefix

设置所有请求的前缀。

用于装饰一个类，类下的方法在生成请求配置的时候，会使用传入的参数作为请求的前缀。

```ts
@Prefix('https://some.site.com')
class Req {}
```

#### Get

装饰方法，调用该方法后，会把方法的返回值作为参数，发起一个`get`请求。

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

可以携带第二个参数，会替代装饰在类上的前缀。

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


有些情况下，参数是带在路径上的，可以通过占位符的方式解决。

在`path`中通过`:placeholder`的方式占位，这时候返回值需要变成数组，第二个参数来返回占位同名的参数，这样在处理参数过程中，`booze`会对占位符进行替换。

```ts
@Prefix('https://some.site.com')
class Req {
  @Get('/list/:id')
  public getList() {
    return [{
      page: 1,
    }, {
      id: 996,
    }];
  }
}
```

注：装饰请求方法的装饰器，必须放在第一位。

#### Post

装饰方法，调用该方法后，会把方法的返回值作为参数，发起一个`Post`请求。

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

额外携带的请求头，可以传递三种形式的参数。


```ts
// 设置一组
class Req {
  @Post('/')
  @Headers('Authorization', 'Bearer .......')
  public updateSomeThing() {
    return {};
  }
}

// 传递对象
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

// 传递函数
class Req {
  @Post('/')
  @Headers((config: BoozeRequestConfig) => {
    return {};
  })
  public updateSomeThing() {
    return {};
  }
}
```

#### JSONP

标记请求为JSONP的形式处理。

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

请求发送前会调用，如果返回 `false` ，请求就会被中断。

如果装饰在类上，则每个方法被调用的时候都会触发。

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

请求被响应后调用。

如果装饰在类上，则每个方法被调用的时候都会触发。

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

给某个请求单独指定适配器。

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

也可以传递字符串，会从注册过的适配器里匹配`name`属性。

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

在原始方法被执行前会执行，如果返回false，会中断请求的发送。

```ts
@Prefix('https://some.site.com')
@BeforeExecSourceFn(() => {})
class Req {
  @Delete('/')
  @BeforeExecSourceFn(() => {})
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

注册适配器，可以注册多个，默认使用第一个作为适配器，可以通过`setAdapter`切换。

```ts
import { regAdapter } from 'booze';

// 注册一个
regAdapter(axiosAdapter);
// 注册多个
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

设置适配器，有多个适配器的时候，可以直接通过`name`指定，也可以传入一个新的适配器。

```ts
import { setAdapter } from 'booze';

setAdapter('xhrAdapter');

setAdapter({
  name: '',
  handler: () => {},
});
```

#### makeBody

如果需要一些特殊需求，如取消请求、进度条展示等，可以用到这个方法。

```ts
@Prefix('https://some.site.com')
class Req {
  @Get('/list')
  public getList() {
    return makeBody {
      // body中的参数
      params: {},
      // 被拼到url上的参数
      query: {},
      // 路径参数
      placeholder: {},
      // 进度条变化回调
      onProgress: () => {},
      // 取消请求
      cancel: () => {},
      // jsonp callback的名称
      jsonp: '',
    };
  }
}
```

#### eachBeforeExecSourceFnGlobal

注册全局的钩子，会在原始方法被调用前触发。

如果返回值是 `false` 则会中断请求。

```ts
import { eachBeforeExecSourceFnGlobal } from 'booze';

eachBeforeExecSourceFnGlobal((baseConfig) => {
  console.log(baseConfig);
});
```

#### eachAfter

注册全局的钩子，会在适配器执行后触发。

```ts
import { eachAfter } from 'booze';

eachAfter((response, baseConfig) => {
  console.log(baseConfig);
});
```

## 开发注意点

### 数据类型问题

因为方法被装饰器重写了，所以调用方法后得到的返回值，类型推断层面会存在问题，官方也有相关[ISSUE](https://github.com/microsoft/TypeScript/issues/49229)。

推荐采用`as`的方式：

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

### 装饰顺序问题

标记请求方法的装饰器，必须放在第一个。

包括：

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
  // 这样会运行异常，Get必须放在最前面
  @After()
  @Get('/')
  public getSomeThing() {
    return {};
  }
}
```
