import { Adapter as IAdapter } from '../src/adapter';
import Adapter from '../src/decorators/Adapter';
import Headers from '../src/decorators/Headers';
import Post from '../src/decorators/HTTPMethods/Post';
import { Prefix, _prefixSymbol } from '../src/index';

const adapter: IAdapter = {
  name: 'testAdapter',
  async handler(config: any) {
    console.log(config);
  },
}

@Prefix('https://test.com')
class Request {
  @Post('123')
  @Headers('Auth', '123')
  @Adapter(adapter)
  public test() {
    return {
      a: 1,
    };
  }
}

const req = new Request();

// console.log((req as any)[_prefixSymbol])
req.test();
