# booze

> 项目构建中...

booze是一个客户端HTTP上层应用框架，使客户端请求代码编写核心为描述一个请求。

booze不提供请求的能力，只收集请求信息，通过一个适配器递交给底层的请求引擎，所以兼容所有请求方案。

## 安装

```shell
npm i booze -S
```

## 使用

```ts
import { Prefix, Get, regAdapter } from 'booze';
import { axiosAdapter } from 'booze/adapter';

// 注册适配器 使用axios为底层请求框架
useAdapter(axiosAdapter);

// 设置服务域名
@Prefix('https://some.site.com')
class Request {
  // 表示给一个get请求，接口为/list
  @Get('/list')
  public getList(page: number) {
    // 返回值被booze处理后会作为一部分参数，递交给axios，返回值就是服务端响应的内容
    return {
      page,
    };
  }
}

const service = new Request();

service.getList(1);
```
