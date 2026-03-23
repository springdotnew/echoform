import React, { useCallback, useEffect, useRef } from "react";
import SocketIO from "socket.io";
import type { Transport } from "@react-fullstack/fullstack/shared";
import type { Server as ServerBase, ServerProps } from "@react-fullstack/fullstack/server";
import type { Server as HTTPServer } from "http";

interface Props extends Pick<ServerProps, 'children' | 'singleInstance' | 'instanceRenderHandler'> {
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

  const getProps = useCallback((): ServerProps => {
    const { children, singleInstance, instanceRenderHandler } = props;

    const transport: Transport<{ readonly connection: Transport<{ readonly disconnect: void }> & { readonly id: string } }> = {
      on: (event, callback) => {
        if (event === "connection") {
          server.on("connection", (socket: SocketIO.Socket) => {
            (callback as (data: unknown) => void)(socket);
          });
        }
      },
      emit: (event, data) => {
        server.sockets.emit(event as string, data);
      },
      off: (event, callback) => {
        server.sockets.removeListener(event as string, callback as (...args: unknown[]) => void);
        if (event === "connection") {
          server.removeAllListeners("connection");
        }
      },
    };

    return {
      transport: transport as ServerProps['transport'],
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
