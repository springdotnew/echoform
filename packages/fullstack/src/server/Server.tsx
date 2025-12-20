import React, { useState, useEffect, useRef, type ReactNode } from "react";
import { Transport, ViewsRenderer } from "../shared";
import App, { type AppHandle } from "./App";

export interface ServerProps<
  TransportClientEvents extends { disconnect: any },
  TransportServerEvents extends {
    connection: Transport<TransportClientEvents> & { id: string };
  }
> {
  children: () => ReactNode;
  singleInstance?: boolean;
  transport: Transport<TransportServerEvents>;
  instanceRenderHandler?: ServerInstanceRenderHandler;
}

const setApp = Symbol("setApp");

export function createInstanceRenderHandler() {
  let appHandle: AppHandle | null = null;
  return {
    [setApp]: (newAppHandle: AppHandle | null) => {
      appHandle = newAppHandle;
    },
    render(views: Record<string, React.ComponentType<any>>) {
      return <ViewsRenderer viewsData={appHandle?.views || []} views={views} />;
    },
  };
}

export type ServerInstanceRenderHandler = ReturnType<
  typeof createInstanceRenderHandler
>;

export function Server<
  TransportClientEvents extends { disconnect: any },
  TransportServerEvents extends {
    connection: Transport<TransportClientEvents> & { id: string };
  }
>(props: ServerProps<TransportClientEvents, TransportServerEvents>) {
  const { children, singleInstance, transport } = props;
  const appRef = useRef<AppHandle>(null);
  const [clients, setClients] = useState<Record<string, Transport<any>>>({});

  useEffect(() => {
    transport.on("connection", (clientTransport) => {
      if (appRef.current) {
        if (singleInstance) {
          appRef.current.addClient(clientTransport);
        } else {
          setClients((clients) => {
            const newClients = { ...clients };
            newClients[clientTransport.id] = clientTransport;
            return newClients;
          });
        }
      }
      clientTransport.on("disconnect", () => {
        if (appRef.current) {
          if (singleInstance) {
            appRef.current.removeClient(clientTransport);
          } else {
            setClients((clients) => {
              const newClients = { ...clients };
              delete newClients[clientTransport.id];
              return newClients;
            });
          }
        }
      });
    });
  }, [singleInstance, transport]);

  return (
    <>
      <App
        paused={!singleInstance}
        transport={transport}
        transportIsClient={false}
        children={children}
        ref={(handle) => {
          (appRef as React.MutableRefObject<AppHandle | null>).current = handle;
          if (props.instanceRenderHandler) {
            props.instanceRenderHandler[setApp](handle);
          }
        }}
      />
      {!singleInstance &&
        Object.keys(clients).map((id) => (
          <App
            transport={clients[id]}
            transportIsClient
            children={children}
            key={id}
            paused={false}
          />
        ))}
    </>
  );
}
