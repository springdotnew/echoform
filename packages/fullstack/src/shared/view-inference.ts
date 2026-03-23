import type { ReactNode } from "react";
import type { StandardSchemaV1 } from "./standard-schema";
import type { ViewDef, CallbackDef, StreamDef } from "./view-builder";
import type { StreamUid } from "./branded.types";
import type { SerializableValue } from "./types";

// ---- Schema record inference ----

type InferSchemaRecord<R extends Record<string, StandardSchemaV1>> = {
  readonly [K in keyof R]: StandardSchemaV1.InferInput<R[K]>;
};

// ---- Stream handles ----

/** Server-side: push chunks to connected clients. */
export interface StreamEmitter<T> {
  readonly emit: (chunk: T) => void;
  readonly end: () => void;
}

/** Client-side: receive chunks from the server. */
export interface StreamReceiver<T> {
  readonly subscribe: (listener: (chunk: T) => void) => () => void;
}

// ---- Runtime stream emitter factory ----

export interface StreamEmitterHandle<T = unknown> extends StreamEmitter<T> {
  readonly uid: StreamUid;
}

export function createStreamEmitter<T>(
  uid: StreamUid,
  onChunk: (streamUid: StreamUid, chunk: SerializableValue) => void,
  onEnd: (streamUid: StreamUid) => void,
): StreamEmitterHandle<T> {
  return {
    uid,
    emit: (chunk: T) => onChunk(uid, chunk as SerializableValue),
    end: () => onEnd(uid),
  };
}

// ---- Callback inference ----

type InferServerCallback<C extends object> =
  C extends CallbackDef<infer TInput, infer TOutput>
    ? StandardSchemaV1.InferInput<TInput> extends void
      ? () =>
          | StandardSchemaV1.InferOutput<TOutput>
          | Promise<StandardSchemaV1.InferOutput<TOutput>>
      : (
          input: StandardSchemaV1.InferInput<TInput>,
        ) =>
          | StandardSchemaV1.InferOutput<TOutput>
          | Promise<StandardSchemaV1.InferOutput<TOutput>>
    : never;

/** Client-side callback handle. */
export interface ClientCallback<TInput, TOutput, TViewName extends string = string, TCallbackName extends string = string> {
  readonly mutate: [TInput] extends [void]
    ? () => Promise<TOutput>
    : (input: TInput) => Promise<TOutput>;
}

/**
 * Adapt a ClientCallback for TanStack Query integration.
 *
 * ```ts
 * const mutation = useMutation(toMutationOptions(callback, "viewName", "propName"));
 * ```
 */
export function toMutationOptions<TInput, TOutput>(
  cb: ClientCallback<TInput, TOutput>,
  viewName: string,
  propName: string,
): {
  readonly mutationFn: ClientCallback<TInput, TOutput>['mutate'];
  readonly mutationKey: readonly [string, string];
} {
  return {
    mutationFn: cb.mutate,
    mutationKey: [viewName, propName] as const,
  };
}

type InferClientCallback<C extends object, TViewName extends string = string, TCallbackName extends string = string> =
  C extends CallbackDef<infer TInput, infer TOutput>
    ? ClientCallback<
        StandardSchemaV1.InferInput<TInput>,
        StandardSchemaV1.InferOutput<TOutput>,
        TViewName,
        TCallbackName
      >
    : never;

// ---- Stream inference ----

type InferServerStream<S extends object> =
  S extends StreamDef<infer TChunk>
    ? StreamEmitter<StandardSchemaV1.InferInput<TChunk>>
    : never;

type InferClientStream<S extends object> =
  S extends StreamDef<infer TChunk>
    ? StreamReceiver<StandardSchemaV1.InferOutput<TChunk>>
    : never;

// ---- Server props ----

/**
 * Infer the props a server component receives for a given ViewDef.
 *
 * - Input schemas → their inferred data types
 * - Callbacks → handler functions the server must provide
 * - Streams → StreamEmitter handles
 * - children is added automatically
 */
export type InferServerProps<V extends ViewDef> =
  V extends ViewDef<
    string,
    infer TInput,
    infer TCallbacks,
    infer TStreams
  >
    ? InferSchemaRecord<TInput> &
        {
          readonly [K in keyof TCallbacks]: InferServerCallback<TCallbacks[K]>;
        } &
        {
          readonly [K in keyof TStreams]: InferServerStream<TStreams[K]>;
        } & {
          readonly children?: ReactNode;
        }
    : never;

// ---- Client props ----

/**
 * Infer the props a client component receives for a given ViewDef.
 *
 * - Input schemas → their inferred data types
 * - Callbacks → async functions with `.queryOptions()`
 * - Streams → StreamReceiver handles
 * - children is added automatically
 */
export type InferClientProps<V extends ViewDef> =
  V extends ViewDef<
    infer TName,
    infer TInput,
    infer TCallbacks,
    infer TStreams
  >
    ? InferSchemaRecord<TInput> &
        {
          readonly [K in keyof TCallbacks & string]: InferClientCallback<
            TCallbacks[K],
            TName,
            K
          >;
        } &
        {
          readonly [K in keyof TStreams]: InferClientStream<TStreams[K]>;
        } & {
          readonly children?: ReactNode;
        }
    : never;
