# booze

> 项目构建中...

booze是一个客户端HTTP上层应用框架，使客户端请求代码编写核心为描述一个请求。

## 安装

```shell
npm i booze -S
```

## 使用

```ts
import { Prefix, Get, regAdapter } from 'booze';
import { axiosAdapter } from 'booze/adapter';

useAdapter(axiosAdapter);

@Prefix('https://some.site.com')
class Request {
  @Get('/list')
  public getList(page: number) {
    return {
      page,
    };
  }
}

const service = new Request();

service.getList(1);
```
