import { useState, useEffect } from "react";
import type { Transport } from "@react-fullstack/fullstack/shared";

export interface WebSocketTransportState {
  readonly transport: Transport<Record<string, unknown>> | null;
  readonly error: string | null;
  readonly isConnected: boolean;
}

export function useWebSocketTransport(url: string): WebSocketTransportState {
  const [state, setState] = useState<WebSocketTransportState>({
    transport: null,
    error: null,
    isConnected: false,
  });

  useEffect(() => {
    const handlers = new Map<string, Set<(data: unknown) => void>>();
    let disposed = false;

    const ws = new WebSocket(url);

    const transport: Transport<Record<string, unknown>> = {
      on: (event: string, handler: (data: unknown) => void): void => {
        const set = handlers.get(event) ?? new Set();
        set.add(handler);
        handlers.set(event, set);
      },
      emit: (event: string, data?: unknown): void => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ event, data }));
        }
      },
      off: (event: string, handler: (data: unknown) => void): void => {
        handlers.get(event)?.delete(handler);
      },
    };

    ws.onopen = () => {
      if (!disposed) {
        setState({ transport, error: null, isConnected: true });
      }
    };

    ws.onmessage = (messageEvent) => {
      try {
        const { event, data } = JSON.parse(messageEvent.data as string) as {
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
    };

    ws.onerror = () => {
      if (!disposed) {
        setState({ transport: null, error: "WebSocket connection failed", isConnected: false });
      }
    };

    ws.onclose = () => {
      if (!disposed) {
        const disconnectHandlers = handlers.get("disconnect");
        if (disconnectHandlers) {
          for (const handler of disconnectHandlers) {
            handler(undefined);
          }
        }
        setState((prev) => (prev.isConnected ? { ...prev, isConnected: false } : prev));
      }
    };

    return () => {
      disposed = true;
      ws.close();
    };
  }, [url]);

  return state;
}
