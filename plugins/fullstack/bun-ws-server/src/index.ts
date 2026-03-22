import type { Transport } from "@react-fullstack/fullstack/shared";

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

interface ClientState {
  readonly ws: ServerWebSocket<ClientData>;
  readonly handlers: Map<string, Set<(data: unknown) => void>>;
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

function generateId(): string {
  return globalThis.crypto.randomUUID();
}

export function createBunWebSocketServer(options: BunWebSocketServerOptions): BunWebSocketServer {
  const { port, hostname = "0.0.0.0", path = "/ws" } = options;

  const clients = new Map<string, ClientState>();
  let connectionHandler: ((client: Transport<SocketClientEvents> & { id: string }) => void) | null = null;
  let server: BunServer | null = null;

  function createClientTransport(
    ws: ServerWebSocket<ClientData>,
    id: string
  ): Transport<SocketClientEvents> & { id: string } {
    const handlers = new Map<string, Set<(data: unknown) => void>>();

    const transport: Transport<SocketClientEvents> & { id: string } = {
      id,
      on: (event, handler) => {
        const eventHandlers = handlers.get(event as string) ?? new Set();
        eventHandlers.add(handler as (data: unknown) => void);
        handlers.set(event as string, eventHandlers);
      },
      emit: (event, data) => {
        ws.send(JSON.stringify({ event, data }));
      },
      off: (event, handler) => {
        const eventHandlers = handlers.get(event as string);
        if (eventHandlers) {
          eventHandlers.delete(handler as (data: unknown) => void);
        }
      },
    };

    clients.set(id, { ws, handlers });
    return transport;
  }

  function handleMessage(id: string, message: string): void {
    const client = clients.get(id);
    if (!client) return;

    try {
      const { event, data } = JSON.parse(message) as { event: string; data: unknown };
      const eventHandlers = client.handlers.get(event);
      if (eventHandlers) {
        for (const handler of eventHandlers) {
          handler(data);
        }
      }
    } catch {
      // Invalid JSON, ignore
    }
  }

  function handleDisconnect(id: string): void {
    const client = clients.get(id);
    if (!client) return;

    const disconnectHandlers = client.handlers.get("disconnect");
    if (disconnectHandlers) {
      for (const handler of disconnectHandlers) {
        handler(undefined);
      }
    }
    clients.delete(id);
  }

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
            data: { id: generateId() },
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
          const clientTransport = createClientTransport(ws, ws.data.id);
          connectionHandler?.(clientTransport);
        },
        message(ws: ServerWebSocket<ClientData>, message: string | ArrayBuffer | Uint8Array) {
          handleMessage(ws.data.id, typeof message === "string" ? message : new TextDecoder().decode(message));
        },
        close(ws: ServerWebSocket<ClientData>) {
          handleDisconnect(ws.data.id);
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
