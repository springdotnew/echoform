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
 * Parses a JSON message and dispatches to registered handlers.
 */
export function parseAndDispatch(message: string, handlers: HandlerRegistry): void {
  try {
    const { event, data } = JSON.parse(message) as {
      readonly event: string;
      readonly data: unknown;
    };
    const eventHandlers = handlers.get(event);
    if (eventHandlers) {
      for (const handler of eventHandlers) {
        handler(data);
      }
    }
  } catch {
    // Invalid message format
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
  readonly send: (data: string) => void;
  readonly readyState?: number;
}

/**
 * Creates a Transport backed by a WebSocket-like connection with JSON serialization.
 * Eliminates duplicated handler registry + JSON marshal boilerplate across plugins.
 */
export function createWebSocketTransport<TEvents extends Record<string, unknown> = Record<string, unknown>>(
  ws: WebSocketLike,
  opts?: { readonly checkOpen?: boolean },
): {
  readonly transport: import("./types").Transport<TEvents>;
  readonly handlers: HandlerRegistry;
  readonly dispatch: (message: string) => void;
  readonly disconnect: () => void;
} {
  const { handlers, on, off } = createHandlerRegistry();
  const checkOpen = opts?.checkOpen ?? false;

  const transport: import("./types").Transport<TEvents> = {
    on: on as import("./types").Transport<TEvents>['on'],
    emit: ((event: string, data?: unknown): void => {
      if (checkOpen && ws.readyState !== 1) return;
      ws.send(JSON.stringify({ event, data }));
    }) as import("./types").Transport<TEvents>['emit'],
    off: off as import("./types").Transport<TEvents>['off'],
  };

  return {
    transport,
    get handlers() { return handlers; },
    dispatch: (message: string) => parseAndDispatch(message, handlers),
    disconnect: () => fireDisconnect(handlers),
  };
}
