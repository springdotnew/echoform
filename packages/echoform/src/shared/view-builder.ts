import { useContext, type ReactElement, type ReactNode } from "react";
import type { StandardSchemaV1 } from "./standard-schema";
import type { ViewProps } from "./types";
import type { InferServerProps } from "./view-inference";
import { ViewFactoryContext } from "./view-factory";

// ---- Branded tag ----

declare const VIEW_DEF_BRAND: unique symbol;

// ---- CallbackDef ----

export interface CallbackDef<
  TInput extends StandardSchemaV1 = StandardSchemaV1<void>,
  TOutput extends StandardSchemaV1 = StandardSchemaV1<void>,
> {
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
  readonly chunk: TChunk;
}

// ---- ViewDef ----

export interface ViewDef<
  TName extends string = string,
  TInput extends Record<string, StandardSchemaV1> = Record<
    string,
    StandardSchemaV1
  >,
  TCallbacks extends Record<string, object> = Record<string, object>,
  TStreams extends Record<string, object> = Record<string, object>,
> {
  readonly [VIEW_DEF_BRAND]: true;
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
  TCallbacks extends Record<string, object> = Record<string, object>,
  TStreams extends Record<string, object> = Record<string, object>,
> {
  readonly input?: TInput;
  readonly callbacks?: TCallbacks;
  readonly streams?: TStreams;
}

// ---- ViewDefs (registry) ----

export type ViewDefs = Readonly<Record<string, ViewDef>>;

// ---- ViewDef registry ----

const viewDefRegistry = new Map<string, ViewDef>();

export function getViewDef(name: string): ViewDef | undefined {
  return viewDefRegistry.get(name);
}

// ---- ServerView type ----

export type ServerView<V extends ViewDef = ViewDef> = V & React.FC<InferServerProps<V>>;

// ---- Schema helpers ----

const voidSchema: StandardSchemaV1<void> = {
  "~standard": {
    version: 1,
    vendor: "echoform",
    validate: () => ({ value: undefined as void }),
    types: {
      input: undefined as void,
      output: undefined as void,
    },
  },
};

/**
 * Create a passthrough schema that accepts any value and casts it to type T.
 * Useful for complex types that can't be expressed with zod/valibot alone.
 *
 * ```ts
 * import { passthrough } from "@playfast/echoform";
 * const MyView = view("MyView", { input: { data: passthrough<MyType>() } });
 * ```
 */
export function passthrough<T>(): StandardSchemaV1<T> {
  return {
    "~standard": {
      version: 1,
      vendor: "passthrough",
      validate: (value) => ({ value: value as T }),
    },
  };
}

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
    chunk: chunkSchema,
  };
}

/**
 * Define a view with input schemas, callbacks, and streams.
 * Returns a React component that can be used directly in server JSX.
 * Also acts as a ViewDef for type inference with InferClientProps/InferServerProps.
 *
 * ```ts
 * export const MyView = view("MyView", {
 *   input: { title: z.string() },
 *   callbacks: { onSave: callback({ input: z.string() }) },
 *   streams: { output: stream(z.string()) },
 * });
 *
 * // Server: use directly as JSX
 * <MyView title="Hello" onSave={(text) => save(text)} output={stream} />
 *
 * // Client: infer props
 * type Props = InferClientProps<typeof MyView>;
 * ```
 */
export function view<
  TName extends string,
  TInput extends Record<string, StandardSchemaV1> = {},
  TCallbacks extends Record<string, object> = {},
  TStreams extends Record<string, object> = {},
>(
  name: TName,
  config?: ViewConfig<TInput, TCallbacks, TStreams>,
): ServerView<ViewDef<TName, TInput, TCallbacks, TStreams>> {
  const def = {
    name,
    input: (config?.input ?? {}) as TInput,
    callbacks: (config?.callbacks ?? {}) as TCallbacks,
    streams: (config?.streams ?? {}) as TStreams,
  };

  const component = (props: Record<string, unknown>): ReactElement => {
    const factory = useContext(ViewFactoryContext);
    if (!factory) throw new Error(`<${name}> must be rendered inside a <Server> component`);
    return factory(name, props as ViewProps & { readonly children?: ReactNode });
  };
  Object.defineProperty(component, "name", { value: name, configurable: true });
  component.displayName = `View(${name})`;
  const { name: _, ...defWithoutName } = def;
  Object.assign(component, defWithoutName);

  viewDefRegistry.set(name, def as unknown as ViewDef);

  return component as unknown as ServerView<ViewDef<TName, TInput, TCallbacks, TStreams>>;
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
