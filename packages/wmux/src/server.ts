import type { Transport } from "@playfast/echoform/shared";
import { createWebSocketTransport } from "@playfast/echoform/shared";
import { createTokenValidator } from "./token";

interface ClientData {
  readonly id: string;
}

interface SocketClientEvents {
  readonly disconnect: void;
}

interface SocketServerEvents {
  readonly connection: Transport<SocketClientEvents> & { readonly id: string };
}

export interface WmuxServerOptions {
  readonly port: number;
  readonly hostname: string;
  readonly token: string;
  readonly clientUrl: string;
}

export interface WmuxServer {
  readonly transport: Transport<SocketServerEvents>;
  readonly server: ReturnType<typeof Bun.serve>;
  readonly stop: () => void;
}

export function createWmuxServer(options: WmuxServerOptions): WmuxServer {
  const { port, hostname, token, clientUrl } = options;
  const validateToken = createTokenValidator(token);

  type ClientEntry = {
    readonly dispatch: (msg: string | ArrayBuffer | Uint8Array<ArrayBufferLike>) => void;
    readonly disconnect: () => void;
  };
  const clients = new Map<string, ClientEntry>();
  let connectionHandler: ((client: SocketServerEvents["connection"]) => void) | null = null;

  const transport: Transport<SocketServerEvents> = {
    on: (_event, handler) => { connectionHandler = handler; },
    emit: () => {},
    off: () => { connectionHandler = null; },
  };

  const server = Bun.serve({
    port,
    hostname,
    fetch(req, srv) {
      const url = new URL(req.url);

      // CORS preflight with Local Network Access
      if (req.method === "OPTIONS") {
        const headers: Record<string, string> = {
          "Access-Control-Allow-Origin": req.headers.get("Origin") ?? "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        };
        if (req.headers.get("Access-Control-Request-Local-Network") === "true") {
          headers["Access-Control-Allow-Local-Network"] = "true";
        }
        return new Response(null, { headers });
      }

      // WebSocket upgrade with token validation
      if (url.pathname === "/ws") {
        const candidateToken = url.searchParams.get("token");
        if (!candidateToken || !validateToken(candidateToken)) {
          return new Response("Unauthorized", { status: 401 });
        }
        const upgraded = srv.upgrade(req, {
          data: { id: globalThis.crypto.randomUUID() } as any,
        });
        if (upgraded) return undefined;
        return new Response("WebSocket upgrade failed", { status: 500 });
      }

      // Build redirect URL using actual port (handles port=0 auto-assign)
      const actualPort = srv.port;
      const wsHost = hostname === "0.0.0.0" || hostname === "127.0.0.1" ? "localhost" : hostname;
      const wsUrl = `ws://${wsHost}:${actualPort}/ws`;
      const fullClientUrl = `${clientUrl}/#token=${encodeURIComponent(token)}&ws=${encodeURIComponent(wsUrl)}`;

      return new Response(null, {
        status: 302,
        headers: {
          Location: fullClientUrl,
          "Access-Control-Allow-Origin": "*",
        },
      });
    },
    websocket: {
      open(ws) {
        const data = ws.data as unknown as ClientData;
        const id = data.id;
        const { transport: clientTransport, dispatch, disconnect } = createWebSocketTransport<Record<string, unknown>>(ws as any);
        const clientWithId: Transport<SocketClientEvents> & { readonly id: string } = { ...clientTransport, id };
        clients.set(id, { dispatch, disconnect });
        connectionHandler?.(clientWithId);
      },
      message(ws, message) {
        const data = ws.data as unknown as ClientData;
        const client = clients.get(data.id);
        if (client) client.dispatch(message as string | ArrayBuffer | Uint8Array);
      },
      close(ws) {
        const data = ws.data as unknown as ClientData;
        const client = clients.get(data.id);
        if (client) {
          client.disconnect();
          clients.delete(data.id);
        }
      },
    },
  });

  const stop = (): void => {
    server.stop();
    clients.clear();
  };

  return { transport, server, stop };
}
