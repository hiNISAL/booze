import type { BodyType, HeaderMap, Query } from '../types';

// Detected by tag rather than instanceof so the core does not depend on host globals.
const NATIVE_BODY_TAGS = new Set(['FormData', 'Blob', 'File', 'URLSearchParams', 'ReadableStream', 'ArrayBuffer', 'SharedArrayBuffer']);

const tagOf = (value: unknown) => Object.prototype.toString.call(value).slice(8, -1);

/** Bodies the platform knows how to send (and to label with a content-type) on its own. */
export const isNativeBody = (value: unknown): boolean =>
  typeof value === 'string' || ArrayBuffer.isView(value) || NATIVE_BODY_TAGS.has(tagOf(value));

const toFormData = (body: Record<string, unknown>): unknown => {
  const FormDataCtor = (globalThis as { FormData?: new () => { append(key: string, value: unknown): void } }).FormData;

  if (!FormDataCtor) {
    throw new TypeError('[booze] bodyType "multipart" needs a global FormData; pass a FormData body instead.');
  }

  const form = new FormDataCtor();

  for (const [key, value] of Object.entries(body)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item === undefined) continue;
      form.append(key, tagOf(item) === 'Blob' || tagOf(item) === 'File' ? item : String(item));
    }
  }

  return form;
};

/**
 * Serializes a body according to its body type and sets content-type in `headers` (lower-case
 * keys) unless one is already there. Native bodies are passed through without a content-type
 * so the platform can set it (multipart boundaries, for example).
 */
export const serializeBody = (
  body: unknown,
  bodyType: BodyType,
  headers: HeaderMap,
  serializeQuery: (query: Query) => string,
): unknown => {
  if (body === undefined || bodyType === 'raw' || isNativeBody(body)) return body;

  const contentType = (type: string) => {
    if (!('content-type' in headers)) headers['content-type'] = type;
  };

  switch (bodyType) {
    case 'form':
      contentType('application/x-www-form-urlencoded');
      return serializeQuery(body as Query);
    case 'multipart':
      return toFormData(body as Record<string, unknown>);
    case 'text':
      contentType('text/plain;charset=UTF-8');
      return String(body);
    default:
      contentType('application/json');
      return JSON.stringify(body);
  }
};
