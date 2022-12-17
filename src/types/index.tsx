type RequestMethod = 'POST'|'GET'|'PUT'|'DELETE'|'OPTIONS'|'PATCH'|'HEAD';

interface BoozeConfig {
  url: string;
  method: RequestMethod;
  queryString: string;
  query: Record<string, string>;
  params: Record<string, any>;
  headers: Record<string, string>;
  onProgress: Function|null;
}
