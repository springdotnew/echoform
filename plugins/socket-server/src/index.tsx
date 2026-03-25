import React, { useEffect, useMemo, useRef } from "react";
import SocketIO from "socket.io";
import type { Transport } from "@playfast/echoform/shared";
import type { Server as ServerBase, ServerProps } from "@playfast/echoform/server";
import type { Server as HTTPServer } from "http";

interface Props extends Pick<ServerProps, 'children' | 'singleInstance' | 'instanceRenderHandler' | 'skipCallbackValidation'> {
  readonly port?: number;
  readonly server?: HTTPServer;
  readonly socketOptions?: Partial<SocketIO.ServerOptions>;
  readonly validateConnection?: (socket: SocketIO.Socket) => boolean | Promise<boolean>;
  readonly maxListeners?: number;
}

interface SocketServerComponentProps extends Props {
  readonly ServerBase: typeof ServerBase;
}

function SocketServer(props: SocketServerComponentProps): React.ReactElement {
  const { ServerBase } = props;
  const serverRef = useRef<SocketIO.Server | null>(null);
  const connectionWrappersRef = useRef(new Map<(data: unknown) => void, (socket: SocketIO.Socket) => void>());

  if (!serverRef.current) {
    if (!props.server && !props.port) {
      throw new Error("port is required when server is not passed");
    }

    const server = props.server
      ? new SocketIO.Server(props.server, props.socketOptions)
      : new SocketIO.Server(props.socketOptions);

    const listenerLimit = props.maxListeners ?? 100;
    server.setMaxListeners(listenerLimit);
    server.on("connection", (socket: SocketIO.Socket) => {
      socket.setMaxListeners(listenerLimit);
    });

    if (props.validateConnection) {
      const validate = props.validateConnection;
      server.use(async (socket, next) => {
        try {
          const allowed = await Promise.resolve(validate(socket));
          next(allowed ? undefined : new Error("Connection rejected"));
        } catch (validationError) {
          console.error("echoform: connection validation error", validationError);
          next(new Error("Connection validation error"));
        }
      });
    }

    if (!props.server && props.port) {
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

  const transport = useMemo((): Transport<{ readonly connection: Transport<{ readonly disconnect: void }> & { readonly id: string } }> => {
    const connectionWrappers = connectionWrappersRef.current;
    return {
      on: (event, callback) => {
        if (event !== "connection") return;
        const typedCallback = callback as (data: unknown) => void;
        const wrapper = (socket: SocketIO.Socket): void => { typedCallback(socket); };
        connectionWrappers.set(typedCallback, wrapper);
        server.on("connection", wrapper);
      },
      emit: (event, data) => {
        server.sockets.emit(event as string, data);
      },
      off: (event, callback) => {
        if (event !== "connection") return;
        const typedCallback = callback as (data: unknown) => void;
        const wrapper = connectionWrappers.get(typedCallback);
        if (!wrapper) return;
        server.removeListener("connection", wrapper);
        connectionWrappers.delete(typedCallback);
      },
    };
  }, [server]);

  return (
    <ServerBase
      transport={transport as ServerProps['transport']}
      singleInstance={props.singleInstance}
      instanceRenderHandler={props.instanceRenderHandler}
      skipCallbackValidation={props.skipCallbackValidation}
    >
      {props.children}
    </ServerBase>
  );
}

function createSocketServer(Server: typeof ServerBase): React.FC<Props> {
  return (props: Props): React.ReactElement => <SocketServer {...props} ServerBase={Server} />;
}

export { createSocketServer };
export type { Props as SocketServerProps };
