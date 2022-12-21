export type RequestMethod = 'POST'|'GET'|'PUT'|'DELETE'|'OPTIONS'|'PATCH'|'HEAD';

export interface BoozeRequestConfig {
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

export type Obj = Record<string, any>;

export interface MakeBodyOptions {
  placeholders?: Obj;
  params?: Obj;
  query?: Obj|string;
  onProgress?: Function;
  cancel?: Function;
  jsonp?: boolean|string;
}

export type BoozeRequestMethodReturnValue = MakeBodyOptions|Obj|[Obj, Obj?];

export interface BoozeRequestConfigBase {
  url: string;
  method: string;
  prefix: string;
  args: any[];
}
