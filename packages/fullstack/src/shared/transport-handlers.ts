/**
 * Shared transport handler utilities for WebSocket-based transports.
 * Eliminates duplication between client and server transport implementations.
 */

export type EventHandlerFn = (data: unknown) => void;
export type HandlerRegistry = ReadonlyMap<string, ReadonlySet<EventHandlerFn>>;

/**
 * Creates a handler registry with on/off/dispatch operations.
 * All mutations produce new Set/Map instances for immutability.
 */
export function createHandlerRegistry(): {
  readonly handlers: HandlerRegistry;
  readonly on: (event: string, handler: EventHandlerFn) => void;
  readonly off: (event: string, handler: EventHandlerFn) => void;
} {
  let handlers = new Map<string, Set<EventHandlerFn>>();

  return {
    get handlers(): HandlerRegistry { return handlers; },
    on: (event: string, handler: EventHandlerFn): void => {
      const existing = handlers.get(event);
      const newSet = new Set(existing);
      newSet.add(handler);
      handlers = new Map(handlers);
      handlers.set(event, newSet);
    },
    off: (event: string, handler: EventHandlerFn): void => {
      const existing = handlers.get(event);
      if (!existing) return;
      const newSet = new Set(existing);
      newSet.delete(handler);
      handlers = new Map(handlers);
      if (newSet.size === 0) {
        handlers.delete(event);
      } else {
        handlers.set(event, newSet);
      }
    },
  };
}

/**
 * Dispatches a binary message to the "__bin__" event handlers.
 */
export function dispatchBinary(data: Uint8Array, handlers: HandlerRegistry): void {
  const binHandlers = handlers.get("__bin__");
  if (binHandlers) {
    for (const handler of binHandlers) {
      handler(data);
    }
  }
}

/**
 * Fires disconnect handlers in a handler registry.
 */
export function fireDisconnect(handlers: HandlerRegistry): void {
  const disconnectHandlers = handlers.get("disconnect");
  if (disconnectHandlers) {
    for (const handler of disconnectHandlers) {
      handler(undefined);
    }
  }
}

/**
 * WebSocket-like interface for creating transports.
 */
export interface WebSocketLike {
  send(data: string | Uint8Array | ArrayBuffer | ArrayBufferView): void;
  readonly readyState?: number;
}

/**
 * Creates a Transport backed by a WebSocket-like connection with binary serialization.
 * The "__bin__" event carries Uint8Array payloads (typed-binary encoded).
 * All other events use JSON for backward compatibility.
 */
export function createWebSocketTransport<TEvents extends Record<string, unknown> = Record<string, unknown>>(
  ws: WebSocketLike,
  opts?: { readonly checkOpen?: boolean },
): {
  readonly transport: import("./types").Transport<TEvents>;
  readonly handlers: HandlerRegistry;
  readonly dispatch: (message: string | ArrayBuffer | Uint8Array) => void;
  readonly disconnect: () => void;
} {
  const registry = createHandlerRegistry();
  const checkOpen = opts?.checkOpen ?? false;

  const transport: import("./types").Transport<TEvents> = {
    on: registry.on as import("./types").Transport<TEvents>['on'],
    emit: ((event: string, data?: unknown): void => {
      if (checkOpen && ws.readyState !== 1) return;
      if (event === "__bin__" && data instanceof Uint8Array) {
        ws.send(data);
      } else {
        ws.send(JSON.stringify({ event, data }));
      }
    }) as import("./types").Transport<TEvents>['emit'],
    off: registry.off as import("./types").Transport<TEvents>['off'],
  };

  return {
    transport,
    get handlers() { return registry.handlers; },
    dispatch: (message: string | ArrayBuffer | Uint8Array) => {
      if (typeof message === "string") {
        // Legacy JSON message
        try {
          const { event, data } = JSON.parse(message) as { event: string; data: unknown };
          const eventHandlers = registry.handlers.get(event);
          if (eventHandlers) {
            for (const handler of eventHandlers) {
              handler(data);
            }
          }
        } catch (err) {
          console.warn("[echoform] Failed to parse JSON message:", err);
        }
      } else {
        // Binary message → dispatch to __bin__ handlers
        const bytes = message instanceof Uint8Array ? message : new Uint8Array(message);
        dispatchBinary(bytes, registry.handlers);
      }
    },
    disconnect: () => fireDisconnect(registry.handlers),
  };
}
