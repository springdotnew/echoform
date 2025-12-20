import React, { useState, useEffect, useRef, type ReactNode } from "react";
import type { Transport } from "../shared/types";
import { ViewsRenderer } from "../shared/ViewsRenderer";
import App, { type AppHandle } from "./App";

interface DisconnectEvent {
  readonly disconnect: void;
}

interface ConnectionEvent<TClientTransport> {
  readonly connection: TClientTransport & { readonly id: string };
}

export interface ServerProps<
  TransportClientEvents extends DisconnectEvent,
  TransportServerEvents extends ConnectionEvent<Transport<TransportClientEvents>>
> {
  readonly children: () => ReactNode;
  readonly singleInstance?: boolean;
  readonly transport: Transport<TransportServerEvents>;
  readonly instanceRenderHandler?: ServerInstanceRenderHandler;
}

const setApp = Symbol("setApp");

export function createInstanceRenderHandler(): ServerInstanceRenderHandler {
  let appHandle: AppHandle | null = null;
  return {
    [setApp]: (newAppHandle: AppHandle | null): void => {
      appHandle = newAppHandle;
    },
    render<TViews extends Readonly<Record<string, React.ComponentType<Record<string, unknown>>>>>(views: TViews): React.ReactElement {
      return <ViewsRenderer viewsData={appHandle?.views ?? []} views={views} />;
    },
  };
}

export interface ServerInstanceRenderHandler {
  readonly [setApp]: (newAppHandle: AppHandle | null) => void;
  readonly render: <TViews extends Readonly<Record<string, React.ComponentType<Record<string, unknown>>>>>(views: TViews) => React.ReactElement;
}

export function Server<
  TransportClientEvents extends DisconnectEvent,
  TransportServerEvents extends ConnectionEvent<Transport<TransportClientEvents>>
>(props: ServerProps<TransportClientEvents, TransportServerEvents>): React.ReactElement {
  const { children, singleInstance, transport } = props;
  const appRef = useRef<AppHandle>(null);
  const [clients, setClients] = useState<Readonly<Record<string, Transport<TransportClientEvents>>>>({});

  useEffect(() => {
    console.log("[Server] Setting up connection handler");
    transport.on("connection", (clientTransport) => {
      console.log("[Server] Client connected, appRef.current:", !!appRef.current, "singleInstance:", singleInstance);
      if (appRef.current) {
        if (singleInstance) {
          console.log("[Server] Adding client to single instance app");
          appRef.current.addClient(clientTransport);
        } else {
          setClients((prevClients) => ({
            ...prevClients,
            [clientTransport.id]: clientTransport,
          }));
        }
      }
      clientTransport.on("disconnect", () => {
        if (appRef.current) {
          if (singleInstance) {
            appRef.current.removeClient(clientTransport);
          } else {
            setClients((prevClients) => {
              const { [clientTransport.id]: _removed, ...rest } = prevClients;
              return rest;
            });
          }
        }
      });
    });
  }, [singleInstance, transport]);

  const clientIds = Object.keys(clients);

  return (
    <>
      <App
        paused={!singleInstance}
        transport={transport as unknown as Transport<Record<string | number, unknown>>}
        transportIsClient={false}
        ref={(handle) => {
          (appRef as React.MutableRefObject<AppHandle | null>).current = handle;
          if (props.instanceRenderHandler) {
            props.instanceRenderHandler[setApp](handle);
          }
        }}
      >
        {children}
      </App>
      {!singleInstance &&
        clientIds.map((id) => {
          const clientTransport = clients[id];
          if (!clientTransport) {
            return null;
          }
          return (
            <App
              transport={clientTransport as unknown as Transport<Record<string | number, unknown>>}
              transportIsClient
              key={id}
              paused={false}
            >
              {children}
            </App>
          );
        })}
    </>
  );
}
