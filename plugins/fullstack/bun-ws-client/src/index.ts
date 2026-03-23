import { useState, useEffect } from "react";
import type { Transport } from "@react-fullstack/fullstack/shared";
import { createWebSocketTransport } from "@react-fullstack/fullstack/shared";

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
    let disposed = false;

    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";

    const { transport, dispatch, disconnect } = createWebSocketTransport(ws, { checkOpen: true });

    ws.onopen = () => {
      if (!disposed) {
        setState({ transport, error: null, isConnected: true });
      }
    };

    ws.onmessage = (messageEvent) => {
      dispatch(messageEvent.data as string | ArrayBuffer);
    };

    ws.onerror = () => {
      if (!disposed) {
        setState({ transport: null, error: "WebSocket connection failed", isConnected: false });
      }
    };

    ws.onclose = () => {
      if (!disposed) {
        disconnect();
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
