import type { Query } from '../types';
import { BoozeError } from './errors';

const ORIGIN = /^(?:[a-z][a-z\d+\-.]*:)?\/\/[^/?#]*/i;

const isAbsolute = (url: string) => ORIGIN.test(url);

/**
 * Joins URL parts with exactly one `/` between them. An absolute part (`https://…` or `//…`)
 * discards everything before it.
 */
export const joinURL = (...parts: Array<string | undefined>): string => {
  let url = '';

  for (const part of parts) {
    if (!part) continue;

    if (isAbsolute(part) || url === '') {
      url = part;
      continue;
    }

    url = `${url.replace(/\/+$/, '')}/${part.replace(/^\/+/, '')}`;
  }

  return url;
};

/** Replaces `:name` placeholders in the path part of a URL. 0 is a valid value. */
export const fillPath = (url: string, params: Record<string, unknown> = {}): string => {
  const origin = url.match(ORIGIN)?.[0] ?? '';
  const rest = url.slice(origin.length);
  const queryStart = rest.search(/[?#]/);
  const path = queryStart === -1 ? rest : rest.slice(0, queryStart);
  const tail = queryStart === -1 ? '' : rest.slice(queryStart);

  const filled = path.replace(/:(\w+)/g, (_, key: string) => {
    const value = params[key];

    if (value === undefined || value === null) {
      throw new BoozeError('MISSING_PATH_PARAM', `No value for path parameter ":${key}" in "${url}".`);
    }

    return encodeURIComponent(String(value));
  });

  return origin + filled + tail;
};

const encode = encodeURIComponent;

/**
 * Default query serializer: arrays repeat the key (`a=1&a=2`), nested objects use brackets
 * (`b[c]=2`), Dates become ISO strings, `undefined` is skipped and `null` becomes an empty value.
 */
export const serializeQuery = (query: Query): string => {
  const pairs: string[] = [];

  const add = (key: string, value: unknown): void => {
    if (value === undefined) return;

    if (value === null) {
      pairs.push(`${encode(key)}=`);
    } else if (value instanceof Date) {
      pairs.push(`${encode(key)}=${encode(value.toISOString())}`);
    } else if (Array.isArray(value)) {
      for (const item of value) add(key, item);
    } else if (typeof value === 'object') {
      for (const [child, item] of Object.entries(value)) add(`${key}[${child}]`, item);
    } else {
      pairs.push(`${encode(key)}=${encode(String(value))}`);
    }
  };

  for (const [key, value] of Object.entries(query)) add(key, value);

  return pairs.join('&');
};

/** Appends a query string to a URL, keeping any query or hash it already has. */
export const appendQuery = (url: string, queryString: string): string => {
  if (!queryString) return url;

  const hashStart = url.indexOf('#');
  const base = hashStart === -1 ? url : url.slice(0, hashStart);
  const hash = hashStart === -1 ? '' : url.slice(hashStart);
  const separator = !base.includes('?') ? '?' : /[?&]$/.test(base) ? '' : '&';

  return `${base}${separator}${queryString}${hash}`;
};
