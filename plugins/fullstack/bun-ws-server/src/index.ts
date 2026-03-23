import type { Transport } from "@react-fullstack/fullstack/shared";
import { createWebSocketTransport } from "@react-fullstack/fullstack/shared";

interface ClientData {
  readonly id: string;
}

interface ServerWebSocket<T = unknown> {
  readonly data: T;
  readonly readyState: number;
  readonly remoteAddress: string;
  send(message: string | ArrayBuffer | Uint8Array, compress?: boolean): number;
  close(code?: number, reason?: string): void;
}

interface BunServer {
  readonly pendingWebSockets: number;
  publish(topic: string, data: string | ArrayBufferView | ArrayBuffer, compress?: boolean): number;
  upgrade(req: Request, options?: { headers?: HeadersInit; data?: ClientData }): boolean;
  stop(): void;
}

interface SocketClientEvents {
  readonly disconnect: void;
}

interface SocketServerEvents {
  readonly connection: Transport<SocketClientEvents> & { readonly id: string };
}

export interface BunWebSocketServerOptions {
  readonly port: number;
  readonly hostname?: string;
  readonly path?: string;
}

export interface BunWebSocketServer {
  readonly transport: Transport<SocketServerEvents>;
  readonly start: () => BunServer;
  readonly stop: () => void;
}

declare const Bun: {
  serve<T>(options: {
    port: number;
    hostname?: string;
    fetch(req: Request, server: BunServer): Response | undefined | Promise<Response | undefined>;
    websocket: {
      data: T;
      open?(ws: ServerWebSocket<T>): void;
      message?(ws: ServerWebSocket<T>, message: string | ArrayBuffer | Uint8Array): void;
      close?(ws: ServerWebSocket<T>, code: number, reason: string): void;
    };
  }): BunServer;
};

export function createBunWebSocketServer(options: BunWebSocketServerOptions): BunWebSocketServer {
  const { port, hostname = "0.0.0.0", path = "/ws" } = options;

  const clients = new Map<string, { readonly dispatch: (msg: string) => void; readonly disconnect: () => void }>();
  let connectionHandler: ((client: Transport<SocketClientEvents> & { id: string }) => void) | null = null;
  let server: BunServer | null = null;

  const transport: Transport<SocketServerEvents> = {
    on: (event, handler) => {
      if (event === "connection") {
        connectionHandler = handler as unknown as (client: Transport<SocketClientEvents> & { id: string }) => void;
      }
    },
    emit: () => {},
    off: () => {
      connectionHandler = null;
    },
  };

  const start = (): BunServer => {
    server = Bun.serve<ClientData>({
      port,
      hostname,
      fetch(req: Request, srv: BunServer) {
        const url = new URL(req.url);

        if (url.pathname === path) {
          const upgraded = srv.upgrade(req, {
            data: { id: globalThis.crypto.randomUUID() },
          });
          if (upgraded) {
            return undefined;
          }
          return new Response("WebSocket upgrade failed", { status: 500 });
        }

        if (req.method === "OPTIONS") {
          return new Response(null, {
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type",
            },
          });
        }

        return new Response("react-fullstack Bun WebSocket Server", {
          headers: { "Access-Control-Allow-Origin": "*" },
        });
      },
      websocket: {
        data: {} as ClientData,
        open(ws: ServerWebSocket<ClientData>) {
          const id = ws.data.id;
          const { transport: clientTransport, dispatch, disconnect } = createWebSocketTransport<SocketClientEvents>(ws);
          const clientWithId = Object.assign(clientTransport, { id });
          clients.set(id, { dispatch, disconnect });
          connectionHandler?.(clientWithId);
        },
        message(ws: ServerWebSocket<ClientData>, message: string | ArrayBuffer | Uint8Array) {
          const client = clients.get(ws.data.id);
          if (client) {
            client.dispatch(typeof message === "string" ? message : new TextDecoder().decode(message));
          }
        },
        close(ws: ServerWebSocket<ClientData>) {
          const client = clients.get(ws.data.id);
          if (client) {
            client.disconnect();
            clients.delete(ws.data.id);
          }
        },
      },
    });

    return server;
  };

  const stop = (): void => {
    server?.stop();
    server = null;
    clients.clear();
  };

  return { transport, start, stop };
}

export type { SocketClientEvents, SocketServerEvents };
