import { invoke } from '../core/invoke';
import { isDecoratorContext, methodLayer, resolveTarget } from '../core/metadata';
import type { BoozeRequest } from '../request';
import type { HttpMethod } from '../types';

type RequestMethod<This, Args extends unknown[], Result> = (this: This, ...args: Args) => BoozeRequest<Result>;

/**
 * An HTTP method decorator. It only accepts methods that return `request<T>()`, so the
 * decorated method's type, `(...args) => BoozeRequest<T>`, is what calling it really gives.
 */
export interface HttpMethodDecorator {
  // TC39 standard decorators
  <This, Args extends unknown[], Result>(
    value: RequestMethod<This, Args, Result>,
    context: ClassMethodDecoratorContext<This, RequestMethod<This, Args, Result>>,
  ): RequestMethod<This, Args, Result>;
  // Legacy decorators (experimentalDecorators)
  <Result>(
    target: object,
    key: string | symbol,
    descriptor: TypedPropertyDescriptor<(...args: any[]) => BoozeRequest<Result>>,
  ): void;
}

/** Declares the HTTP method and path of a request. Use the shorthands (`@Get`, `@Post`, …) where possible. */
export function Request(method: HttpMethod, path = ''): HttpMethodDecorator {
  const decorator = (value: unknown, contextOrKey: unknown, descriptor?: PropertyDescriptor): unknown => {
    const target = resolveTarget(method, value, contextOrKey);

    if (target.kind !== 'method') {
      throw new TypeError(`[booze] @${method}('${path}') can only decorate methods.`);
    }

    const layer = methodLayer(target.metadata, target.isStatic, target.name);

    if (layer.method) {
      throw new TypeError(`[booze] ${String(target.name)}() has two HTTP method decorators (${layer.method} and ${method}).`);
    }

    layer.method = method.toUpperCase();
    layer.path = path;

    const original = (isDecoratorContext(contextOrKey) ? value : descriptor?.value) as (...args: unknown[]) => unknown;
    const name = target.name as string | symbol;
    const declaredIn = target.metadata;

    const wrapped = function (this: unknown, ...args: unknown[]) {
      return invoke({ original, thisArg: this, args, name, layer, declaredIn });
    };

    Object.defineProperty(wrapped, 'name', { value: original.name });

    if (isDecoratorContext(contextOrKey)) return wrapped;

    descriptor!.value = wrapped;

    return descriptor;
  };

  return decorator as HttpMethodDecorator;
}

export const Get = (path?: string): HttpMethodDecorator => Request('GET', path);
export const Post = (path?: string): HttpMethodDecorator => Request('POST', path);
export const Put = (path?: string): HttpMethodDecorator => Request('PUT', path);
export const Delete = (path?: string): HttpMethodDecorator => Request('DELETE', path);
export const Patch = (path?: string): HttpMethodDecorator => Request('PATCH', path);
export const Head = (path?: string): HttpMethodDecorator => Request('HEAD', path);
export const Options = (path?: string): HttpMethodDecorator => Request('OPTIONS', path);
