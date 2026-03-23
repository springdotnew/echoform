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
}

/**
 * Wraps a raw transport (binary WebSocket) to provide typed AppEvents access.
 *
 * - emit: encodes AppEvents to binary via typed-binary, sends through raw transport
 * - on: receives binary from raw transport, decodes, dispatches to typed handlers
 */
export function decompileTransport<TEvents extends Record<string | number, unknown>>(transport: Transport<TEvents>): DecompileTransport {
  // Collect handlers per app event name
  const appHandlers = new Map<string, Set<(data: unknown) => void>>();

  // Single listener on the raw transport for binary messages
  let rawListenerAttached = false;

  function ensureRawListener(): void {
    if (rawListenerAttached) return;
    rawListenerAttached = true;

    (transport.on as (event: string, handler: (data: unknown) => void) => void)("__bin__", (raw: unknown) => {
      try {
        const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw as ArrayBuffer);
        const { event, data } = decodeMessage(bytes);

        // Apply branded types to decoded data
        const branded = applyBrands(event, data);

        const handlers = appHandlers.get(event);
        if (handlers) {
          for (const handler of handlers) {
            handler(branded);
          }
        }
      } catch {
        // Invalid binary message
      }
    });
  }

  const on = <Key extends keyof AppEvents>(
    event: Key,
    handler: (data: AppEvents[Key]) => void
  ): (() => void) | undefined => {
    ensureRawListener();

    const eventName = event as string;
    let handlerSet = appHandlers.get(eventName);
    if (!handlerSet) {
      handlerSet = new Set();
      appHandlers.set(eventName, handlerSet);
    }
    handlerSet.add(handler as (data: unknown) => void);

    return () => {
      handlerSet!.delete(handler as (data: unknown) => void);
      if (handlerSet!.size === 0) {
        appHandlers.delete(eventName);
      }
    };
  };

  const emit = <Key extends keyof AppEvents>(event: Key, data?: AppEvents[Key]): void => {
    const bytes = encodeMessage(event as string, data);
    (transport.emit as (event: string, data: unknown) => void)("__bin__", bytes);
  };

  return { on, emit };
}

/**
 * Apply branded types to decoded data.
 * typed-binary decodes to plain strings; we wrap them in branded types.
 */
function applyBrands(event: string, data: unknown): unknown {
  if (!data || typeof data !== "object") return data;

  switch (event) {
    case "delete_view": {
      const d = data as { viewUid: string };
      return { viewUid: createViewUid(d.viewUid) };
    }
    case "request_event": {
      const d = data as { eventArguments: unknown[]; uid: string; eventUid: string };
      return {
        eventArguments: d.eventArguments,
        eventUid: createEventUid(d.eventUid),
        uid: createRequestUid(d.uid),
      };
    }
    case "respond_to_event": {
      const d = data as { data: unknown; uid: string; eventUid: string };
      return {
        data: d.data,
        eventUid: createEventUid(d.eventUid),
        uid: createRequestUid(d.uid),
      };
    }
    case "update_view": {
      const d = data as { view: any };
      return {
        view: {
          ...d.view,
          uid: createViewUid(d.view.uid),
          parentUid: createViewUid(d.view.parentUid),
          props: {
            create: (d.view.props.create ?? []).map(brandProp),
            delete: (d.view.props.delete ?? []).map(createPropName),
          },
        },
      };
    }
    case "update_views_tree": {
      const d = data as { views: any[] };
      return {
        views: d.views.map((v: any) => ({
          ...v,
          uid: createViewUid(v.uid),
          parentUid: createViewUid(v.parentUid),
          props: (v.props ?? []).map(brandProp),
        })),
      };
    }
    case "stream_chunk": {
      const d = data as { streamUid: string; chunk: unknown };
      return { streamUid: createStreamUid(d.streamUid), chunk: d.chunk };
    }
    case "stream_end": {
      const d = data as { streamUid: string };
      return { streamUid: createStreamUid(d.streamUid) };
    }
    default:
      return data;
  }
}

function brandProp(prop: any): any {
  if (prop.type === "data") {
    return { name: createPropName(prop.name), type: "data", data: prop.data };
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

function emitFactory(): EmitFunctions {
  const events: Array<keyof AppEvents> = [
    "update_views_tree", "update_view", "delete_view", "request_views_tree",
    "respond_to_event", "request_event", "stream_chunk", "stream_end",
  ];

  const result = {} as Record<string, <TEvents extends Record<string | number, unknown>>(transport: Transport<TEvents>, data?: AppEvents[keyof AppEvents]) => void>;

  for (const event of events) {
    result[event as string] = <TEvents extends Record<string | number, unknown>>(transport: Transport<TEvents>, data?: AppEvents[typeof event]): void => {
      const decompiled = decompileTransport(transport);
      decompiled.emit(event, data);
    };
  }

  return result as EmitFunctions;
}

export const emit = emitFactory();
