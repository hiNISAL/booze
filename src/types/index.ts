export type RequestMethod = 'POST'|'GET'|'PUT'|'DELETE'|'OPTIONS'|'PATCH'|'HEAD';

export interface BoozeRequestConfig {
  url: string;
  method: RequestMethod;
  queryString: string;
  query: Record<string, string>;
  params: Record<string, any>;
  headers: Record<string, string>;
  onProgress: Function|null;
  _prefix: string;
  _url: string;
}

export type Obj = Record<string, any>;

export interface MakeBodyOptions {
  placeholders?: Obj;
  params?: Obj;
  query?: Obj|string;
  onProgress?: Function;
}

export type BoozeRequestMethodReturnValue = MakeBodyOptions|Obj|[Obj, Obj?];
