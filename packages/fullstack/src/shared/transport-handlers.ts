/**
 * Shared transport handler utilities for WebSocket-based transports.
 * Eliminates duplication between client and server transport implementations.
 */

export type EventHandlerFn = (data: unknown) => void;
export type HandlerRegistry = Map<string, Set<EventHandlerFn>>;

/**
 * Creates a handler registry with on/off/dispatch operations.
 */
export function createHandlerRegistry(): {
  readonly handlers: HandlerRegistry;
  readonly on: (event: string, handler: EventHandlerFn) => void;
  readonly off: (event: string, handler: EventHandlerFn) => void;
} {
  const handlers: HandlerRegistry = new Map();

  return {
    handlers,
    on: (event: string, handler: EventHandlerFn): void => {
      const set = handlers.get(event) ?? new Set();
      set.add(handler);
      handlers.set(event, set);
    },
    off: (event: string, handler: EventHandlerFn): void => {
      handlers.get(event)?.delete(handler);
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
