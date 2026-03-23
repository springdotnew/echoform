import type { StandardSchemaV1 } from "./standard-schema";

// ---- Branded tag ----

declare const VIEW_DEF_BRAND: unique symbol;

// ---- CallbackDef ----

export interface CallbackDef<
  TInput extends StandardSchemaV1 = StandardSchemaV1<void>,
  TOutput extends StandardSchemaV1 = StandardSchemaV1<void>,
> {
  readonly _tag: "callback";
  readonly input: TInput;
  readonly output: TOutput;
}

export interface CallbackConfig<
  TInput extends StandardSchemaV1 = StandardSchemaV1<void>,
  TOutput extends StandardSchemaV1 = StandardSchemaV1<void>,
> {
  readonly input?: TInput;
  readonly output?: TOutput;
}

// ---- StreamDef ----

export interface StreamDef<
  TChunk extends StandardSchemaV1 = StandardSchemaV1,
> {
  readonly _tag: "stream";
  readonly chunk: TChunk;
}

// ---- ViewDef ----

export interface ViewDef<
  TName extends string = string,
  TInput extends Record<string, StandardSchemaV1> = Record<
    string,
    StandardSchemaV1
  >,
  TCallbacks extends Record<string, CallbackDef> = Record<
    string,
    CallbackDef
  >,
  TStreams extends Record<string, StreamDef> = Record<string, StreamDef>,
> {
  readonly [VIEW_DEF_BRAND]: true;
  readonly _tag: "view";
  readonly name: TName;
  readonly input: TInput;
  readonly callbacks: TCallbacks;
  readonly streams: TStreams;
}

export interface ViewConfig<
  TInput extends Record<string, StandardSchemaV1> = Record<
    string,
    StandardSchemaV1
  >,
  TCallbacks extends Record<string, CallbackDef> = Record<
    string,
    CallbackDef
  >,
  TStreams extends Record<string, StreamDef> = Record<string, StreamDef>,
> {
  readonly input?: TInput;
  readonly callbacks?: TCallbacks;
  readonly streams?: TStreams;
}

// ---- ViewDefs (registry) ----

export type ViewDefs = Readonly<Record<string, ViewDef>>;

// ---- Void schema (default for callbacks with no input/output) ----

const voidSchema: StandardSchemaV1<void> = {
  "~standard": {
    version: 1,
    vendor: "react-fullstack",
    validate: () => ({ value: undefined as void }),
    types: {
      input: undefined as void,
      output: undefined as void,
    },
  },
};

// ---- Builder functions ----

/**
 * Define a callback with optional input and output schemas.
 *
 * ```ts
 * callback() // no input, no output
 * callback({ input: z.object({ text: z.string() }) })
 * callback({ input: z.string(), output: z.boolean() })
 * ```
 */
export function callback<
  TInput extends StandardSchemaV1 = StandardSchemaV1<void>,
  TOutput extends StandardSchemaV1 = StandardSchemaV1<void>,
>(config?: CallbackConfig<TInput, TOutput>): CallbackDef<TInput, TOutput> {
  return {
    _tag: "callback",
    input: (config?.input ?? voidSchema) as TInput,
    output: (config?.output ?? voidSchema) as TOutput,
  };
}

/**
 * Define a server-to-client stream with a chunk schema.
 *
 * ```ts
 * stream(z.object({ data: z.string() }))
 * ```
 */
export function stream<TChunk extends StandardSchemaV1>(
  chunkSchema: TChunk,
): StreamDef<TChunk> {
  return {
    _tag: "stream",
    chunk: chunkSchema,
  };
}

/**
 * Define a view with input schemas, callbacks, and streams.
 *
 * ```ts
 * export const MyView = view("MyView", {
 *   input: { title: z.string() },
 *   callbacks: { onSave: callback({ input: z.string() }) },
 *   streams: { output: stream(z.string()) },
 * });
 * ```
 */
export function view<
  TName extends string,
  TInput extends Record<string, StandardSchemaV1> = Record<string, never>,
  TCallbacks extends Record<string, CallbackDef> = Record<string, never>,
  TStreams extends Record<string, StreamDef> = Record<string, never>,
>(
  name: TName,
  config?: ViewConfig<TInput, TCallbacks, TStreams>,
): ViewDef<TName, TInput, TCallbacks, TStreams> {
  return {
    _tag: "view",
    name,
    input: (config?.input ?? {}) as TInput,
    callbacks: (config?.callbacks ?? {}) as TCallbacks,
    streams: (config?.streams ?? {}) as TStreams,
  } as ViewDef<TName, TInput, TCallbacks, TStreams>;
}

/**
 * Compose individual view definitions into a registry.
 * Validates that the record key matches the view name at runtime.
 *
 * ```ts
 * export const views = createViews({ TodoApp, TodoInput });
 * ```
 */
export function createViews<V extends Record<string, ViewDef>>(
  defs: V,
): Readonly<V> {
  for (const [key, def] of Object.entries(defs)) {
    if (def.name !== key) {
      throw new Error(
        `View name mismatch: key "${key}" does not match view name "${def.name}"`,
      );
    }
  }
  return defs;
}
