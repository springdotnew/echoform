import type { Transport } from "@react-fullstack/fullstack/shared";

export interface WebSocketClientOptions {
  readonly url: string;
  readonly reconnect?: boolean;
  readonly reconnectInterval?: number;
  readonly maxReconnectAttempts?: number;
}

export interface WebSocketClientTransport {
  readonly transport: Transport<Record<string, unknown>>;
  readonly connect: () => Promise<void>;
  readonly disconnect: () => void;
  readonly isConnected: () => boolean;
}

export function createWebSocketTransport(options: WebSocketClientOptions): WebSocketClientTransport {
  const {
    url,
    reconnect = false,
    reconnectInterval = 1000,
    maxReconnectAttempts = 5,
  } = options;

  const handlers = new Map<string, Set<(data: unknown) => void>>();
  let ws: WebSocket | null = null;
  let connected = false;
  let reconnectAttempts = 0;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  const transport: Transport<Record<string, unknown>> = {
    on: <T extends string>(event: T, handler: (data: unknown) => void): void => {
      const eventHandlers = handlers.get(event) ?? new Set();
      eventHandlers.add(handler);
      handlers.set(event, eventHandlers);
    },
    emit: <T extends string>(event: T, data?: unknown): void => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event, data }));
      }
    },
    off: <T extends string>(event: T, handler: (data: unknown) => void): void => {
      const eventHandlers = handlers.get(event);
      if (eventHandlers) {
        eventHandlers.delete(handler);
      }
    },
  };

  function notifyDisconnect(): void {
    const disconnectHandlers = handlers.get("disconnect");
    if (disconnectHandlers) {
      for (const handler of disconnectHandlers) {
        handler(undefined);
      }
    }
  }

  function attemptReconnect(): void {
    if (!reconnect || reconnectAttempts >= maxReconnectAttempts) {
      return;
    }

    reconnectAttempts++;
    reconnectTimeout = setTimeout(() => {
      connect().catch(() => {
        attemptReconnect();
      });
    }, reconnectInterval);
  }

  function connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      ws = new WebSocket(url);

      ws.onopen = () => {
        connected = true;
        reconnectAttempts = 0;
        resolve();
      };

      ws.onmessage = (event) => {
        try {
          const { event: eventName, data } = JSON.parse(event.data as string) as {
            event: string;
            data: unknown;
          };
          const eventHandlers = handlers.get(eventName);
          if (eventHandlers) {
            for (const handler of eventHandlers) {
              handler(data);
            }
          }
        } catch {
          // Invalid JSON, ignore
        }
      };

      ws.onerror = () => {
        if (!connected) {
          reject(new Error("WebSocket connection error"));
        }
      };

      ws.onclose = () => {
        const wasConnected = connected;
        connected = false;

        if (wasConnected) {
          notifyDisconnect();
          attemptReconnect();
        }
      };
    });
  }

  function disconnect(): void {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    ws?.close();
    ws = null;
    connected = false;
  }

  function isConnected(): boolean {
    return connected && ws?.readyState === WebSocket.OPEN;
  }

  return { transport, connect, disconnect, isConnected };
}

// React hook for using the WebSocket transport
export { createWebSocketTransport as createBunWebSocketClient };
