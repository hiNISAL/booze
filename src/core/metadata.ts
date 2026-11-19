/**
 * Decorator metadata, in both decorator modes. This is the only module that knows about the
 * difference between TC39 standard decorators and legacy (experimentalDecorators) ones.
 *
 * Decorators only *write* configuration here. It is read when a decorated method is called,
 * so the order in which decorators are written does not matter.
 */
import type { Adapter, BodyType, HeaderSource, HttpMethod, Middleware } from '../types';
import type { BoozeClient } from './client';

// Node 24 and current browsers do not ship Symbol.metadata yet. Compilers fall back to
// Symbol.for('Symbol.metadata') (esbuild, Babel) or skip metadata entirely when it is
// missing (tsc), so it has to exist before any decorated class is defined. booze is imported
// before user classes are evaluated, which guarantees that.
const SymbolWithMetadata = Symbol as unknown as { metadata?: symbol };
SymbolWithMetadata.metadata ??= Symbol.for('Symbol.metadata');

export const METADATA_KEY: symbol = SymbolWithMetadata.metadata;

// Symbol.for so that two copies of booze (e.g. ESM and CJS) share decorator metadata.
const STORE = Symbol.for('booze.store');
const LEGACY_METADATA = Symbol.for('booze.legacy-metadata');

export interface Layer {
  /** In application order: decorators lower in the source come first. */
  headers: HeaderSource[];
  bodyType?: BodyType;
  timeout?: number;
  adapter?: Adapter;
  /** Outermost first. */
  middleware: Middleware[];
}

export interface ClassLayer extends Layer {
  prefix?: string;
  client?: BoozeClient;
}

export interface MethodLayer extends Layer {
  method?: HttpMethod;
  path?: string;
}

interface Store {
  cls: ClassLayer;
  methods: Map<PropertyKey, MethodLayer>;
  statics: Map<PropertyKey, MethodLayer>;
}

/** A class's metadata object; its prototype chain follows the class hierarchy. */
export type Metadata = object;

export type DecoratorTarget =
  | { kind: 'class'; metadata: Metadata }
  | { kind: 'method'; metadata: Metadata; isStatic: boolean; name: PropertyKey };

const newLayer = () => ({ headers: [], middleware: [] });

const ownStore = (metadata: Metadata): Store => {
  if (!Object.hasOwn(metadata, STORE)) {
    Object.defineProperty(metadata, STORE, {
      value: { cls: newLayer(), methods: new Map(), statics: new Map() } satisfies Store,
    });
  }

  return (metadata as Record<symbol, Store>)[STORE]!;
};

/**
 * Legacy decorators get no metadata object, so booze keeps one per constructor. Static
 * properties are inherited, so a subclass's object is created with its parent's as prototype.
 */
const legacyMetadata = (ctor: Function): Metadata => {
  const holder = ctor as unknown as Record<symbol, Metadata | undefined>;

  if (!Object.hasOwn(holder, LEGACY_METADATA)) {
    Object.defineProperty(holder, LEGACY_METADATA, {
      value: Object.create(holder[LEGACY_METADATA] ?? null),
      configurable: true,
    });
  }

  return holder[LEGACY_METADATA]!;
};

export const isDecoratorContext = (value: unknown): value is DecoratorContext =>
  typeof value === 'object' && value !== null && 'kind' in value;

/** Works out what a decorator was applied to, in either decorator mode. */
export const resolveTarget = (decorator: string, value: unknown, contextOrKey: unknown): DecoratorTarget => {
  if (isDecoratorContext(contextOrKey)) {
    const metadata = (contextOrKey as { metadata?: Metadata }).metadata;

    if (!metadata) {
      throw new TypeError(
        `[booze] @${decorator}: the compiled code provides no decorator metadata. ` +
        'Import booze before defining decorated classes, or use a compiler that supports decorator metadata.',
      );
    }

    if (contextOrKey.kind === 'class') return { kind: 'class', metadata };

    if (contextOrKey.kind === 'method') {
      return { kind: 'method', metadata, isStatic: contextOrKey.static, name: contextOrKey.name };
    }

    throw new TypeError(`[booze] @${decorator} can only decorate classes and methods, not a ${contextOrKey.kind}.`);
  }

  if (typeof value === 'function' && contextOrKey === undefined) {
    return { kind: 'class', metadata: legacyMetadata(value) };
  }

  if ((typeof contextOrKey === 'string' || typeof contextOrKey === 'symbol') && value !== null && value !== undefined) {
    const isStatic = typeof value === 'function';
    const ctor = isStatic ? value : (value as object).constructor;

    return { kind: 'method', metadata: legacyMetadata(ctor), isStatic, name: contextOrKey };
  }

  throw new TypeError(`[booze] @${decorator} can only decorate classes and methods.`);
};

export const classLayer = (metadata: Metadata): ClassLayer => ownStore(metadata).cls;

export const methodLayer = (metadata: Metadata, isStatic: boolean, name: PropertyKey): MethodLayer => {
  const table = isStatic ? ownStore(metadata).statics : ownStore(metadata).methods;
  let layer = table.get(name);

  if (!layer) {
    layer = newLayer();
    table.set(name, layer);
  }

  return layer;
};

export const layerOf = (target: DecoratorTarget): Layer =>
  target.kind === 'class' ? classLayer(target.metadata) : methodLayer(target.metadata, target.isStatic, target.name);

/** The metadata object of a class, in either mode, including what it inherits. */
export const metadataOf = (ctor: unknown): Metadata | undefined => {
  if (typeof ctor !== 'function') return undefined;

  const holder = ctor as unknown as Record<symbol, Metadata | null | undefined>;

  return holder[METADATA_KEY] ?? holder[LEGACY_METADATA] ?? undefined;
};

/** Class-level layers from the base class down to the most derived one. */
export const classLayers = (metadata: Metadata): ClassLayer[] => {
  const layers: ClassLayer[] = [];

  for (let current: Metadata | null = metadata; current; current = Object.getPrototypeOf(current)) {
    if (Object.hasOwn(current, STORE)) layers.unshift((current as Record<symbol, Store>)[STORE]!.cls);
  }

  return layers;
};

/**
 * The metadata to read class-level config from for a call: that of `this`'s class when it
 * inherits from the class that declared the method (so a subclass's @Prefix applies to
 * inherited methods), otherwise that of the declaring class.
 */
export const callMetadata = (thisArg: unknown, declared: Metadata): Metadata => {
  const ctor = typeof thisArg === 'function'
    ? thisArg
    : typeof thisArg === 'object' && thisArg !== null ? thisArg.constructor : undefined;
  const own = metadataOf(ctor);

  if (own && (own === declared || Object.prototype.isPrototypeOf.call(declared, own))) return own;

  return declared;
};
