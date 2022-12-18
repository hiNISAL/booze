import { Adapter as IAdapter } from '../src/adapter';
import Adapter from '../src/decorators/Adapter';
import Before from '../src/decorators/Before';
import Headers from '../src/decorators/Headers';
import Get from '../src/decorators/HTTPMethods/Get';
import Post from '../src/decorators/HTTPMethods/Post';
import { body, Prefix, _prefixSymbol } from '../src/index';

const adapter: IAdapter = {
  name: 'testAdapter',
  async handler(config: any) {
    console.log('async handler(config: any) {');
    console.log(config);
  },
}

@Prefix('https://test.com')
@Before(() => {
  console.log('class Before');
})
class Request {
  @Get('123/:id')
  // @Headers('Auth', '123')
  @Headers(() => {
    return {
      x: '2'
    }
  })
  @Before((): boolean => {
    console.log('before');

    return true;
  })
  @Adapter(adapter)
  public test() {
    return body({
      placeholders: {id: 1},
      query: {b: 2},
      params: {c: 3},
      onProgress: () => {

      },
    });
  }
}

const req = new Request();

// console.log((req as any)[_prefixSymbol])
req.test();
// console.log(body({
//   params: {
//     a: 1,
//   }
// }));
