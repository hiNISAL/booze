// A typical consumer file, compiled by tsc in both decorator modes (see ../tsc.test.ts).
import {
  Before, BodyType, Client, createClient, Delete, Get, Headers, Post, Prefix, request, Use,
} from '../../../src/index';

interface User {
  id: number;
  name: string;
}

const http = createClient({ baseURL: 'https://api.site.com' });

http.use(async (ctx, next) => {
  ctx.request.headers.authorization = 'Bearer token';
  await next();
});

@Client(http)
@Prefix('/users')
@Headers({ 'x-module': 'user' })
export class UserApi {
  @Get('/')
  list(page = 1, size = 20) {
    return request<User[]>({ query: { page, size } });
  }

  @Get('/:id')
  get(id: number) {
    return request<User>({ path: { id } });
  }

  @BodyType('form')
  @Post('/')
  create(user: Omit<User, 'id'>) {
    return request<User>({ body: user });
  }

  @Delete('/:id')
  @Use(async (_ctx, next) => next())
  @Before(() => true)
  remove(id: number, signal?: AbortSignal) {
    return request<void>({ path: { id }, signal });
  }

  @Get('https://status.site.com/ping')
  static ping() {
    return request<{ ok: boolean }>();
  }
}

export const user: Promise<User> = new UserApi().get(1);
export const ok: Promise<{ ok: boolean }> = UserApi.ping();
