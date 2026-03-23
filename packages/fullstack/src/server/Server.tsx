import React, { useState, useEffect, useRef, type ReactNode } from "react";
import type { Transport } from "../shared/types";
import { ViewsRenderer } from "../shared/ViewsRenderer";
import App, { type AppHandle } from "./App";

type AnyTransport = Transport<Record<string | number, unknown>>;

interface DisconnectEvent {
  readonly disconnect: void;
}

interface ConnectionEvent<TClientTransport> {
  readonly connection: TClientTransport & { readonly id: string };
}

type ServerTransport = Transport<ConnectionEvent<Transport<DisconnectEvent>>>;

export interface ServerProps {
  readonly children: () => ReactNode;
  readonly singleInstance?: boolean;
  readonly transport: ServerTransport;
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

export function Server(props: ServerProps): React.ReactElement {
  const { children, singleInstance, transport } = props;
  const appRef = useRef<AppHandle>(null);
  const [clients, setClients] = useState<Readonly<Record<string, Transport<DisconnectEvent>>>>({});

  useEffect(() => {
    transport.on("connection", (clientTransport) => {
      if (!appRef.current) return;

      if (singleInstance) {
        appRef.current.addClient(clientTransport as AnyTransport);
      } else {
        setClients((prev) => ({ ...prev, [clientTransport.id]: clientTransport }));
      }

      clientTransport.on("disconnect", () => {
        if (!appRef.current) return;

        if (singleInstance) {
          appRef.current.removeClient(clientTransport as AnyTransport);
        } else {
          setClients((prev) => {
            const { [clientTransport.id]: _removed, ...rest } = prev;
            return rest;
          });
        }
      });
    });
  }, [singleInstance, transport]);

  const clientIds = Object.keys(clients);

  return (
    <>
      <App
        paused={!singleInstance}
        transport={transport as unknown as AnyTransport}
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
          if (!clientTransport) return null;
          return (
            <App
              transport={clientTransport as unknown as AnyTransport}
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
