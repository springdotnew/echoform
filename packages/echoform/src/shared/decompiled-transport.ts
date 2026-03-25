/**
 * Decompiled transport: bridges between the raw binary WebSocket transport
 * and the typed AppEvents interface used by the app layer.
 *
 * Uses typed-binary (via binary-protocol.ts) for wire encoding.
 */

import { encodeMessage, decodeMessage } from "./binary-protocol";
import type { AppEvents, Transport } from "./types";
import { createEventUid, createViewUid, createRequestUid, createPropName, createStreamUid } from "./branded.types";

// ---- DecompileTransport ----

export interface DecompileTransport {
  readonly on: <Key extends keyof AppEvents>(
    event: Key,
    handler: (data: AppEvents[Key]) => void
  ) => (() => void) | undefined;
  readonly emit: <Key extends keyof AppEvents>(
    event: Key,
    data?: AppEvents[Key]
  ) => void;
  readonly destroy: () => void;
}

/**
 * Wraps a raw transport (binary WebSocket) to provide typed AppEvents access.
 *
 * - emit: encodes AppEvents to binary via typed-binary, sends through raw transport
 * - on: receives binary from raw transport, decodes, dispatches to typed handlers
 */
export function decompileTransport<TEvents extends Record<string | number, unknown>>(transport: Transport<TEvents>): DecompileTransport {
  const appHandlers = new Map<string, Set<(data: unknown) => void>>();
  let rawListenerAttached = false;
  let rawHandler: ((data: unknown) => void) | null = null;
  let destroyed = false;

  function ensureRawListener(): void {
    if (rawListenerAttached) return;
    rawListenerAttached = true;

    rawHandler = (raw: unknown) => {
      if (destroyed) return;
      try {
        const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw as ArrayBuffer);
        const { event, data } = decodeMessage(bytes);

        const branded = applyBrands(event, data);

        const handlers = appHandlers.get(event);
        if (handlers) {
          for (const handler of handlers) {
            handler(branded);
          }
        }
      } catch (err) {
        console.warn("Failed to decode binary message:", err);
      }
    };

    (transport.on as (event: string, handler: (data: unknown) => void) => void)("__bin__", rawHandler);
  }

  const on = <Key extends keyof AppEvents>(
    event: Key,
    handler: (data: AppEvents[Key]) => void
  ): (() => void) | undefined => {
    if (destroyed) return undefined;
    ensureRawListener();

    const eventName = event as string;
    let handlerSet = appHandlers.get(eventName);
    if (!handlerSet) {
      handlerSet = new Set();
      appHandlers.set(eventName, handlerSet);
    }
    handlerSet.add(handler as (data: unknown) => void);

    return () => {
      const set = appHandlers.get(eventName);
      if (!set) return;
      set.delete(handler as (data: unknown) => void);
      if (set.size === 0) {
        appHandlers.delete(eventName);
      }
    };
  };

  const emit = <Key extends keyof AppEvents>(event: Key, data?: AppEvents[Key]): void => {
    if (destroyed) return;
    const bytes = encodeMessage(event as string, data);
    (transport.emit as (event: string, data: unknown) => void)("__bin__", bytes);
  };

  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;
    if (rawHandler && transport.off) {
      (transport.off as (event: string, handler: (data: unknown) => void) => void)("__bin__", rawHandler);
    }
    rawHandler = null;
    rawListenerAttached = false;
    appHandlers.clear();
  };

  return { on, emit, destroy };
}

/**
 * Apply branded types to decoded data.
 * typed-binary decodes to plain strings; we wrap them in branded types.
 */
interface WireViewBase {
  readonly uid: string;
  readonly name: string;
  readonly parentUid: string;
  readonly childIndex: number;
  readonly isRoot: boolean;
}

interface WireExistingView extends WireViewBase {
  readonly props: ReadonlyArray<UnbrandedProp>;
}

interface WireShareableView extends WireViewBase {
  readonly props: {
    readonly create: ReadonlyArray<UnbrandedProp>;
    readonly delete: ReadonlyArray<string>;
  };
}

function brandExistingView(v: WireExistingView): AppEvents['update_views_tree']['views'][number] {
  return {
    ...v,
    uid: createViewUid(v.uid),
    parentUid: createViewUid(v.parentUid),
    props: v.props.map(brandProp),
  };
}

function brandShareableView(v: WireShareableView): AppEvents['update_view']['view'] {
  return {
    ...v,
    uid: createViewUid(v.uid),
    parentUid: createViewUid(v.parentUid),
    props: {
      create: v.props.create.map(brandProp),
      delete: v.props.delete.map(createPropName),
    },
  };
}

function applyBrands(event: string, data: unknown): unknown {
  if (!data || typeof data !== "object") return data;

  switch (event) {
    case "delete_view": {
      const deletePayload = data as { readonly viewUid: string };
      return { viewUid: createViewUid(deletePayload.viewUid) };
    }
    case "request_event": {
      const requestPayload = data as { readonly eventArguments: ReadonlyArray<unknown>; readonly uid: string; readonly eventUid: string };
      return {
        eventArguments: requestPayload.eventArguments,
        eventUid: createEventUid(requestPayload.eventUid),
        uid: createRequestUid(requestPayload.uid),
      };
    }
    case "respond_to_event": {
      const responsePayload = data as { readonly data: unknown; readonly uid: string; readonly eventUid: string; readonly error?: string };
      return {
        data: responsePayload.data,
        eventUid: createEventUid(responsePayload.eventUid),
        uid: createRequestUid(responsePayload.uid),
        ...(responsePayload.error !== undefined ? { error: responsePayload.error } : {}),
      };
    }
    case "update_view": {
      const updatePayload = data as { readonly view: WireShareableView };
      return { view: brandShareableView(updatePayload.view) };
    }
    case "update_views_tree": {
      const treePayload = data as { readonly views: ReadonlyArray<WireExistingView> };
      return { views: treePayload.views.map(brandExistingView) };
    }
    case "stream_chunk": {
      const chunkPayload = data as { readonly streamUid: string; readonly chunk: unknown };
      return { streamUid: createStreamUid(chunkPayload.streamUid), chunk: chunkPayload.chunk };
    }
    case "stream_end": {
      const endPayload = data as { readonly streamUid: string };
      return { streamUid: createStreamUid(endPayload.streamUid) };
    }
    case "stream_replay": {
      const replayPayload = data as { readonly streamUid: string; readonly chunks: ReadonlyArray<unknown> };
      return { streamUid: createStreamUid(replayPayload.streamUid), chunks: replayPayload.chunks };
    }
    default:
      return data;
  }
}

type UnbrandedProp =
  | { readonly name: string; readonly type: "data"; readonly data: unknown }
  | { readonly name: string; readonly type: "event"; readonly uid: string }
  | { readonly name: string; readonly type: "stream"; readonly uid: string };

function brandProp(prop: UnbrandedProp): import("./types").Prop {
  if (prop.type === "data") {
    return { name: createPropName(prop.name), type: "data", data: prop.data as import("./types").SerializableValue };
  }
  if (prop.type === "event") {
    return { name: createPropName(prop.name), type: "event", uid: createEventUid(prop.uid) };
  }
  return { name: createPropName(prop.name), type: "stream", uid: createStreamUid(prop.uid) };
}

// ---- Convenience emit helpers ----

type EmitFunctions = {
  readonly [Key in keyof AppEvents]: <TEvents extends Record<string | number, unknown>>(transport: Transport<TEvents>, data?: AppEvents[Key]) => void;
};

function createEmitFn<Key extends keyof AppEvents>(event: Key) {
  return <TEvents extends Record<string | number, unknown>>(transport: Transport<TEvents>, data?: AppEvents[Key]): void => {
    const bytes = encodeMessage(event as string, data);
    (transport.emit as (event: string, data: unknown) => void)("__bin__", bytes);
  };
}

function emitFactory(): EmitFunctions {
  return {
    update_views_tree: createEmitFn("update_views_tree"),
    update_view: createEmitFn("update_view"),
    delete_view: createEmitFn("delete_view"),
    request_views_tree: createEmitFn("request_views_tree"),
    respond_to_event: createEmitFn("respond_to_event"),
    request_event: createEmitFn("request_event"),
    stream_chunk: createEmitFn("stream_chunk"),
    stream_end: createEmitFn("stream_end"),
    stream_replay: createEmitFn("stream_replay"),
  };
}

export const emit = emitFactory();
