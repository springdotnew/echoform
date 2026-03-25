import type { Transport } from "@playfast/echoform/shared";
import { createWebSocketTransport, type WebSocketLike } from "@playfast/echoform/shared";

export interface TransportConnection {
  readonly transport: Transport<Record<string, unknown>>;
  readonly waitForConnection: () => Promise<void>;
  readonly destroy: () => void;
}

export const connectTransport = (wsUrl: string, token: string): TransportConnection => {
  const authenticatedUrl = `${wsUrl}?token=${encodeURIComponent(token)}`;
  const ws = new WebSocket(authenticatedUrl);
  ws.binaryType = "arraybuffer";

  const { transport, dispatch, disconnect } = createWebSocketTransport(
    ws as unknown as WebSocketLike,
    { checkOpen: true },
  );

  const connectionPromise = new Promise<void>((resolve, reject) => {
    ws.onopen = () => resolve();
    ws.onerror = () => reject(new Error("WebSocket connection failed"));
  });

  ws.onmessage = (event: MessageEvent) => {
    dispatch(event.data as string | ArrayBuffer);
  };

  ws.onclose = () => {
    disconnect();
  };

  const destroy = (): void => {
    ws.close();
  };

  return { transport, waitForConnection: () => connectionPromise, destroy };
};
