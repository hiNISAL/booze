/**
 * Decorators that only record configuration. They work on a class (applies to all of its
 * methods, including inherited ones) or on a method, in any order relative to `@Get` & co.
 */
import type { BoozeClient } from '../core/client';
import { BoozeError } from '../core/errors';
import { classLayer, type Layer, layerOf, resolveTarget } from '../core/metadata';
import type { Adapter as AdapterContract, BodyType as BodyTypeName, Context, HeaderMap, HeaderSource, Middleware } from '../types';

type AnyClass = abstract new (...args: any) => any;

/** A decorator usable on a class or a method, in either decorator mode. */
export interface ConfigDecorator {
  (value: AnyClass, context: ClassDecoratorContext): void;
  (value: (...args: any) => any, context: ClassMethodDecoratorContext<any, any>): void;
  (target: Function): void;
  (target: object, key: string | symbol, descriptor: PropertyDescriptor): void;
}

/** A decorator usable on a class only, in either decorator mode. */
export interface ClassOnlyDecorator {
  (value: AnyClass, context: ClassDecoratorContext): void;
  (target: Function): void;
}

const configDecorator = (name: string, write: (layer: Layer) => void): ConfigDecorator =>
  ((value: unknown, contextOrKey?: unknown) => {
    write(layerOf(resolveTarget(name, value, contextOrKey)));
  }) as ConfigDecorator;

const classDecorator = (name: string, write: (layer: ReturnType<typeof classLayer>) => void): ClassOnlyDecorator =>
  ((value: unknown, contextOrKey?: unknown) => {
    const target = resolveTarget(name, value, contextOrKey);

    if (target.kind !== 'class') throw new TypeError(`[booze] @${name} can only decorate classes.`);

    write(classLayer(target.metadata));
  }) as ClassOnlyDecorator;

/**
 * Adds headers. Several `@Headers` on the same class or method all apply; on a conflict the
 * one written higher up wins. A function receives the request context and may be async.
 */
export function Headers(headers: HeaderSource): ConfigDecorator;
export function Headers(name: string, value: string): ConfigDecorator;
export function Headers(headersOrName: HeaderSource | string, value?: string): ConfigDecorator {
  const source: HeaderSource = typeof headersOrName === 'string'
    ? { [headersOrName]: value ?? '' } satisfies HeaderMap
    : headersOrName;

  return configDecorator('Headers', (layer) => {
    layer.headers.push(source);
  });
}

/** How plain-object bodies are serialized. Defaults to `'json'`. */
export const BodyType = (type: BodyTypeName): ConfigDecorator =>
  configDecorator('BodyType', (layer) => {
    layer.bodyType = type;
  });

/** Request timeout in milliseconds. */
export const Timeout = (ms: number): ConfigDecorator =>
  configDecorator('Timeout', (layer) => {
    layer.timeout = ms;
  });

/** Sends requests through this adapter instead of the client's. */
export const Adapter = (adapter: AdapterContract): ConfigDecorator =>
  configDecorator('Adapter', (layer) => {
    layer.adapter = adapter;
  });

/**
 * Adds middleware. Within one class or method, decorators written higher up run outermost,
 * and `@Use(a, b)` runs `a` around `b`.
 */
export const Use = (...middleware: Middleware[]): ConfigDecorator =>
  configDecorator('Use', (layer) => {
    // Decorators are applied bottom-up, so each new one is further out.
    layer.middleware.unshift(...middleware);
  });

/** Runs before the request. Returning `false` rejects the call with ABORTED. */
export const Before = (hook: (ctx: Context) => unknown): ConfigDecorator =>
  Use(async (ctx, next) => {
    if (await hook(ctx) === false) {
      throw new BoozeError('ABORTED', `@Before stopped ${String(ctx.name)}().`, { ctx });
    }

    await next();
  });

/** Runs after the request. Any return value other than `undefined` replaces the result. */
export const After = (hook: (result: unknown, ctx: Context) => unknown): ConfigDecorator =>
  Use(async (ctx, next) => {
    await next();

    const replaced = await hook(ctx.result, ctx);

    if (replaced !== undefined) ctx.result = replaced;
  });

/** Path prepended to every method of the class. A subclass's prefix replaces its parent's. */
export const Prefix = (prefix: string): ClassOnlyDecorator =>
  classDecorator('Prefix', (layer) => {
    layer.prefix = prefix;
  });

/** Sends the class's requests through this client instead of the default one. */
export const Client = (client: BoozeClient): ClassOnlyDecorator =>
  classDecorator('Client', (layer) => {
    layer.client = client;
  });
