import type { HeaderMap } from '../types';

/** JSON if it parses, the raw text if it does not, undefined for an empty body. */
export const parseJSON = (text: string): unknown => {
  if (text === '') return undefined;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

/** Responses that never have a body. */
export const hasNoBody = (method: string, status: number): boolean =>
  method.toUpperCase() === 'HEAD' || status === 204 || status === 304;

/** Lower-case keys; multi-value headers joined with ", ". */
export const normalizeHeaders = (headers: Record<string, unknown> | null | undefined): HeaderMap => {
  const out: HeaderMap = {};

  for (const [key, value] of Object.entries(headers ?? {})) {
    if (value === undefined || value === null) continue;
    out[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : String(value);
  }

  return out;
};
