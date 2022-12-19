import { Adapter as IAdapter } from '../src/adapter';
import Adapter from '../src/decorators/Adapter';
import After from '../src/decorators/After';
import Before from '../src/decorators/Before';
import Headers from '../src/decorators/Headers';
import Get from '../src/decorators/HTTPMethods/Get';
import Post from '../src/decorators/HTTPMethods/Post';
import JSONP from '../src/decorators/JSONP';
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
@After(() => {
  console.log('each after');

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
  // @JSONP()
  @After<{a: 1}>((a, b) => {
    console.log('after');
  })
  public test() {
    return body({
      placeholders: {id: 1},
      query: {b: 2},
      params: {c: 3},
      onProgress: () => {

      },
      jsonp: '123',
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
