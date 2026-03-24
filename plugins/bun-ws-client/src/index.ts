import { useState, useEffect } from "react";
import type { Transport } from "@playfast/echoform/shared";
import { createWebSocketTransport, type WebSocketLike } from "@playfast/echoform/shared";

export interface WebSocketTransportState {
  readonly transport: Transport<Record<string, unknown>> | null;
  readonly error: string | null;
  readonly status: "connecting" | "connected" | "error" | "disconnected";
}

export interface WebSocketTransportOptions {
  readonly authToken?: string;
}

function buildAuthenticatedUrl(url: string, authToken?: string): string {
  if (!authToken) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}token=${encodeURIComponent(authToken)}`;
}

export function useWebSocketTransport(url: string, options?: WebSocketTransportOptions): WebSocketTransportState {
  const [state, setState] = useState<WebSocketTransportState>({
    transport: null,
    error: null,
    status: "connecting",
  });

  useEffect(() => {
    let disposed = false;

    const authenticatedUrl = buildAuthenticatedUrl(url, options?.authToken);
    const ws = new WebSocket(authenticatedUrl);
    ws.binaryType = "arraybuffer";

    const { transport, dispatch, disconnect } = createWebSocketTransport(ws as unknown as WebSocketLike, { checkOpen: true });

    ws.onopen = () => {
      if (!disposed) {
        setState({ transport, error: null, status: "connected" });
      }
    };

    ws.onmessage = (messageEvent) => {
      dispatch(messageEvent.data as string | ArrayBuffer);
    };

    ws.onerror = () => {
      if (!disposed) {
        setState({ transport: null, error: "WebSocket connection failed", status: "error" });
      }
    };

    ws.onclose = () => {
      if (!disposed) {
        disconnect();
        setState((prev) => (prev.status === "connected" ? { ...prev, status: "disconnected" as const } : prev));
      }
    };

    return () => {
      disposed = true;
      ws.close();
    };
  }, [url, options?.authToken]);

  return state;
}
