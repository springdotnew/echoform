import { useState, useEffect } from "react";
import type { Transport } from "@play/echoform/shared";
import { createWebSocketTransport, type WebSocketLike } from "@play/echoform/shared";

export interface WebSocketTransportState {
  readonly transport: Transport<Record<string, unknown>> | null;
  readonly error: string | null;
  readonly isConnected: boolean;
  readonly status: "connecting" | "connected" | "error" | "disconnected";
}

export function useWebSocketTransport(url: string): WebSocketTransportState {
  const [state, setState] = useState<WebSocketTransportState>({
    transport: null,
    error: null,
    isConnected: false,
    status: "connecting",
  });

  useEffect(() => {
    let disposed = false;

    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";

    const { transport, dispatch, disconnect } = createWebSocketTransport(ws as unknown as WebSocketLike, { checkOpen: true });

    ws.onopen = () => {
      if (!disposed) {
        setState({ transport, error: null, isConnected: true, status: "connected" });
      }
    };

    ws.onmessage = (messageEvent) => {
      dispatch(messageEvent.data as string | ArrayBuffer);
    };

    ws.onerror = () => {
      if (!disposed) {
        setState({ transport: null, error: "WebSocket connection failed", isConnected: false, status: "error" });
      }
    };

    ws.onclose = () => {
      if (!disposed) {
        disconnect();
        setState((prev) => (prev.isConnected ? { ...prev, isConnected: false, status: "disconnected" as const } : prev));
      }
    };

    return () => {
      disposed = true;
      ws.close();
    };
  }, [url]);

  return state;
}
