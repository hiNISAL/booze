// metadata.ts installs the Symbol.metadata polyfill, so it is evaluated before any user class.
import './core/metadata';

import {
  Adapter as AdapterDecorator,
  BodyType as BodyTypeDecorator,
} from './decorators/shared';
import type { Adapter as AdapterContract, BodyType as BodyTypeName } from './types';

export { request, type BoozeRequest, type FullResult, type RequestFunction } from './request';
export { Delete, Get, Head, Options, Patch, Post, Put, Request, type HttpMethodDecorator } from './decorators/http';
export {
  After, Before, Client, Headers, Prefix, Timeout, Use,
  type ClassOnlyDecorator, type ConfigDecorator,
} from './decorators/shared';
export { BoozeClient, configure, createClient, defaultClient, type ClientOptions } from './core/client';
export { BoozeError, isBoozeError, type BoozeErrorCode } from './core/errors';
export { fetchAdapter, type FetchAdapterOptions } from './adapters/fetch';
export type {
  AdapterRequest, BoozeResponse, Context, HeaderMap, HeaderSource, HttpMethod, Middleware, Next,
  Progress, Query, RequestOptions, RequestState, ResponseType,
} from './types';

/** `@Adapter(adapter)` decorator, and the adapter interface. */
export const Adapter = AdapterDecorator;
export type Adapter = AdapterContract;

/** `@BodyType('json' | 'form' | …)` decorator, and the body type union. */
export const BodyType = BodyTypeDecorator;
export type BodyType = BodyTypeName;
