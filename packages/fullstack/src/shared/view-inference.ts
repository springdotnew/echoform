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

// ---- Runtime stream emitter ----

const STREAM_EMITTER_TAG = Symbol.for("react-fullstack/stream-emitter");

export class StreamEmitterImpl<T = unknown> implements StreamEmitter<T> {
  readonly [STREAM_EMITTER_TAG] = true;
  readonly uid: StreamUid;
  private readonly _onChunk: (streamUid: StreamUid, chunk: SerializableValue) => void;
  private readonly _onEnd: (streamUid: StreamUid) => void;

  constructor(
    uid: StreamUid,
    onChunk: (streamUid: StreamUid, chunk: SerializableValue) => void,
    onEnd: (streamUid: StreamUid) => void,
  ) {
    this.uid = uid;
    this._onChunk = onChunk;
    this._onEnd = onEnd;
  }

  emit(chunk: T): void {
    this._onChunk(this.uid, chunk as SerializableValue);
  }

  end(): void {
    this._onEnd(this.uid);
  }
}

export function isStreamEmitter(value: unknown): value is StreamEmitterImpl {
  return typeof value === "object" && value !== null && STREAM_EMITTER_TAG in value;
}

// ---- Callback inference ----

type InferServerCallback<C extends CallbackDef> =
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

type InferClientCallback<C extends CallbackDef, TViewName extends string = string, TCallbackName extends string = string> =
  C extends CallbackDef<infer TInput, infer TOutput>
    ? (StandardSchemaV1.InferInput<TInput> extends void
        ? () => Promise<StandardSchemaV1.InferOutput<TOutput>>
        : (
            input: StandardSchemaV1.InferInput<TInput>,
          ) => Promise<StandardSchemaV1.InferOutput<TOutput>>) & {
        readonly queryOptions: () => {
          readonly mutationFn: StandardSchemaV1.InferInput<TInput> extends void
            ? () => Promise<StandardSchemaV1.InferOutput<TOutput>>
            : (
                input: StandardSchemaV1.InferInput<TInput>,
              ) => Promise<StandardSchemaV1.InferOutput<TOutput>>;
          readonly mutationKey: readonly [TViewName, TCallbackName];
        };
      }
    : never;

// ---- Stream inference ----

type InferServerStream<S extends StreamDef> =
  S extends StreamDef<infer TChunk>
    ? StreamEmitter<StandardSchemaV1.InferInput<TChunk>>
    : never;

type InferClientStream<S extends StreamDef> =
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
