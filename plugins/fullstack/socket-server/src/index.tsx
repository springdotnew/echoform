import React, { useCallback, useEffect, useRef } from "react";
import SocketIO from "socket.io";
import type { Transport } from "@react-fullstack/fullstack/shared";
import type { Server as ServerBase, ServerProps } from "@react-fullstack/fullstack/server";
import type { Server as HTTPServer } from "http";

interface SocketClientEvents {
  readonly disconnect: void;
}

interface SocketServerEvents {
  readonly connection: Transport<SocketClientEvents> & { readonly id: string };
}

interface Props extends Pick<ServerProps<SocketClientEvents, SocketServerEvents>, 'children' | 'singleInstance' | 'instanceRenderHandler'> {
  readonly port?: number;
  readonly server?: HTTPServer;
  readonly socketOptions?: Partial<SocketIO.ServerOptions>;
}

interface SocketServerComponentProps extends Props {
  readonly ServerBase: typeof ServerBase;
}

function SocketServer(props: SocketServerComponentProps): React.ReactElement {
  const { ServerBase } = props;
  const serverRef = useRef<SocketIO.Server | null>(null);

  if (!serverRef.current) {
    const server = props.server
      ? new SocketIO.Server(props.server, props.socketOptions)
      : new SocketIO.Server(props.socketOptions);

    server.setMaxListeners(Infinity);
    server.on("connection", (socket: SocketIO.Socket) => {
      socket.setMaxListeners(Infinity);
    });

    if (!props.server) {
      if (!props.port) {
        throw new Error("port is required when server is not passed");
      }
      server.listen(props.port);
    }
    serverRef.current = server;
  }

  const server = serverRef.current;

  useEffect(() => {
    return (): void => {
      if (server) {
        server.close();
      }
    };
  }, [server]);

  const getProps = useCallback((): ServerProps<SocketClientEvents, SocketServerEvents> => {
    const { children, singleInstance, instanceRenderHandler } = props;

    const transport: Transport<SocketServerEvents> = {
      on: <T extends keyof SocketServerEvents>(
        event: T,
        callback: (data: SocketServerEvents[T]) => void
      ): void => {
        if (event === "connection") {
          // Socket.IO's connection event passes a Socket, which we treat as Transport
          server.on("connection", (socket: SocketIO.Socket) => {
            callback(socket as unknown as SocketServerEvents[T]);
          });
        }
      },
      emit: <T extends keyof SocketServerEvents>(
        event: T,
        data?: SocketServerEvents[T]
      ): void => {
        server.sockets.emit(event as string, data);
      },
      off: <T extends keyof SocketServerEvents>(
        event: T,
        callback: (data: SocketServerEvents[T]) => void
      ): void => {
        server.sockets.removeListener(event as string, callback as (...args: unknown[]) => void);
        if (event === "connection") {
          server.removeAllListeners("connection");
        }
      },
    };

    return {
      transport,
      singleInstance,
      children,
      instanceRenderHandler,
    };
  }, [props.children, props.singleInstance, props.instanceRenderHandler, server]);

  return <ServerBase {...getProps()} />;
}

function createSocketServer(Server: typeof ServerBase): React.FC<Props> {
  return (props: Props): React.ReactElement => <SocketServer {...props} ServerBase={Server} />;
}

export { createSocketServer };
export type { Props as SocketServerProps };
