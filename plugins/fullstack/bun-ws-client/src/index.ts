import { useState, useEffect } from "react";
import type { Transport } from "@react-fullstack/fullstack/shared";
import { createHandlerRegistry, parseAndDispatch, fireDisconnect } from "@react-fullstack/fullstack/shared";

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
    const { handlers, on, off } = createHandlerRegistry();
    let disposed = false;

    const ws = new WebSocket(url);

    const transport: Transport<Record<string, unknown>> = {
      on: on as Transport<Record<string, unknown>>['on'],
      emit: (event: string, data?: unknown): void => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ event, data }));
        }
      },
      off: off as Transport<Record<string, unknown>>['off'],
    };

    ws.onopen = () => {
      if (!disposed) {
        setState({ transport, error: null, isConnected: true });
      }
    };

    ws.onmessage = (messageEvent) => {
      parseAndDispatch(messageEvent.data as string, handlers);
    };

    ws.onerror = () => {
      if (!disposed) {
        setState({ transport: null, error: "WebSocket connection failed", isConnected: false });
      }
    };

    ws.onclose = () => {
      if (!disposed) {
        fireDisconnect(handlers);
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
