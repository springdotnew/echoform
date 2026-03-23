import React, { useState, useEffect, useRef } from "react";
import { Client as ClientBase } from "@play/echoform/client";
import { connect, type Socket, type ManagerOptions, type SocketOptions } from "socket.io-client";
import type { Transport } from "@play/echoform/shared";
import { emit } from "@play/echoform/shared";

interface Props<ViewsInterface extends Record<string, unknown> = Record<string, unknown>> {
  readonly port: number;
  readonly host: string;
  readonly views: Readonly<Record<string, React.ComponentType<Record<string, unknown>>>>;
  readonly socketOptions?: Partial<ManagerOptions & SocketOptions>;
}

function Client<ViewsInterface extends Record<string, unknown> = Record<string, unknown>>(props: Props<ViewsInterface>): React.ReactElement {
  const { host, port, views, socketOptions } = props;
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = connect(`${host}:${port}`, socketOptions);
    socketRef.current = socket;

    socket.on("connect", () => {
      emit.request_views_tree(socket as Transport<Record<string, unknown>>);
      setConnected(true);
    });

    return (): void => {
      socket.close();
    };
  }, [host, port, socketOptions]);

  if (!connected || !socketRef.current) {
    return <></>;
  }

  return (
    <ClientBase
      transport={socketRef.current as Transport<Record<string, unknown>>}
      views={views as Readonly<Record<string, React.ComponentType<Record<string, unknown>>>>}
    />
  );
}

export { Client };
export type { Props as ClientProps };
