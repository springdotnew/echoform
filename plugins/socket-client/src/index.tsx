import React, { useState, useEffect, useRef } from "react";
import { Client as ClientBase } from "@playfast/echoform/client";
import { connect, type Socket, type ManagerOptions, type SocketOptions } from "socket.io-client";
import type { Transport } from "@playfast/echoform/shared";
import { emit } from "@playfast/echoform/shared";

interface Props {
  readonly port: number;
  readonly host: string;
  readonly views: Readonly<Record<string, React.ComponentType<Record<string, unknown>>>>;
  readonly socketOptions?: Partial<ManagerOptions & SocketOptions>;
  readonly auth?: Readonly<Record<string, string>>;
}

function Client(props: Props): React.ReactElement {
  const { host, port, views, socketOptions, auth } = props;
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = connect(`${host}:${port}`, { ...socketOptions, auth: auth ?? socketOptions?.auth });
    socketRef.current = socket;

    socket.on("connect", () => {
      emit.request_views_tree(socket as Transport<Record<string, unknown>>);
      setConnected(true);
    });

    return (): void => {
      socket.close();
    };
  }, [host, port, socketOptions, auth]);

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

