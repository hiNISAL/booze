// 一段普通的使用方代码，ts-compat.test.ts 会用不同的编译选项对它做类型检查。
import { Get, Headers, Prefix } from '../../src';

@Prefix('https://a.com')
export class Api {
  @Get('/x')
  @Headers('X-A', '1')
  x() {
    return { a: 1 };
  }
}
