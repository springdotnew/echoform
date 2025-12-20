import React, { useState, useEffect, useRef } from "react";
import type { ViewsToComponents } from "@react-fullstack/fullstack/client";
import { Client as ClientBase } from "@react-fullstack/fullstack/client";
import { connect } from "socket.io-client";
import type { Views, Transport } from "@react-fullstack/fullstack/shared";
import { emit } from "@react-fullstack/fullstack/shared";

interface Props<ViewsInterface extends Views> {
  readonly port: number;
  readonly host: string;
  readonly views: ViewsToComponents<ViewsInterface>;
  readonly socketOptions?: SocketIOClient.ConnectOpts;
}

function Client<ViewsInterface extends Views>(props: Props<ViewsInterface>): React.ReactElement {
  const { host, port, views, socketOptions } = props;
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<SocketIOClient.Socket | null>(null);

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
    <ClientBase<ViewsInterface>
      transport={socketRef.current as Transport<Record<string, unknown>>}
      views={views}
    />
  );
}

export { Client };
export type { Props as ClientProps };
