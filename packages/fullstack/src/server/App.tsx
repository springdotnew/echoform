import React, { useRef, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle, type ReactNode } from "react";
import { AppContext, type AppContextValue } from "./contexts";
import { ViewData, ExistingSharedViewData, Prop, Transport, DecompileTransport, decompileTransport, randomId } from "../shared";
import { deeplyEqual } from "./utils";

interface AppProps {
  children: () => ReactNode;
  transport: Transport<any>;
  paused: boolean;
  transportIsClient: boolean;
}

export interface AppHandle {
  views: ExistingSharedViewData[];
  addClient: (client: Transport<any>) => void;
  removeClient: (client: Transport<any>) => void;
}

const App = forwardRef<AppHandle, AppProps>(function App({ children, transport, paused, transportIsClient }, ref) {
  const serverRef = useRef<DecompileTransport>(decompileTransport(transport));
  const clientsRef = useRef<Transport<any>[]>([]);
  const existingSharedViewsRef = useRef<ExistingSharedViewData[]>([]);
  const viewEventsRef = useRef<Map<string, (...args: any) => any | Promise<any>>>(new Map());
  const cleanUpFunctionsRef = useRef<Function[]>([]);

  const registerViewEvent = useCallback((event: (...args: any) => any | Promise<any>): string => {
    const eventUid = randomId();
    viewEventsRef.current.set(eventUid, event);
    return eventUid;
  }, []);

  const registerSocketListener = useCallback((client: DecompileTransport) => {
    const requestViewsTreeHandler = () => {
      client.emit("update_views_tree", {
        views: existingSharedViewsRef.current,
      });
    };
    const cleanReqTree = client.on("request_views_tree", requestViewsTreeHandler);

    const requestEventHandler = ({
      eventArguments,
      eventUid: requestedEventUid,
      uid: currentEventUid,
    }: {
      eventArguments: any[];
      uid: string;
      eventUid: string;
    }) => {
      const handler = viewEventsRef.current.get(requestedEventUid);
      if (!handler) {
        throw new Error(
          "the client is trying to access an event that does not exist"
        );
      }
      const eventResult = handler(...eventArguments);
      if (eventResult instanceof Promise) {
        eventResult.then((result) => {
          client.emit("respond_to_event", {
            data: result && result,
            uid: currentEventUid,
            eventUid: requestedEventUid,
          });
        });
      } else {
        client.emit("respond_to_event", {
          data: eventResult && eventResult,
          uid: currentEventUid,
          eventUid: requestedEventUid,
        });
      }
    };
    const cleanReqEvent = client.on("request_event", requestEventHandler);

    cleanUpFunctionsRef.current.push(() => {
      cleanReqTree();
      cleanReqEvent();
    });
  }, []);

  const addClient = useCallback((client: Transport<any>) => {
    const clientTransport = decompileTransport(client);
    clientsRef.current.push(client);
    registerSocketListener(clientTransport);
  }, [registerSocketListener]);

  const removeClient = useCallback((client: Transport<any>) => {
    clientsRef.current = clientsRef.current.filter(
      (currentClient) => currentClient !== client
    );
  }, []);

  const updateRunningView = useCallback((viewData: ViewData) => {
    const server = serverRef.current;
    if (!server) {
      return;
    }
    const existingView = existingSharedViewsRef.current.find(
      (view) => view.uid === viewData.uid
    );
    const mapProps = (name: string): Prop => {
      const prop = viewData.props[name];
      if (typeof prop === "function") {
        return {
          name,
          type: "event" as const,
          uid: registerViewEvent(prop),
        };
      } else {
        return {
          name,
          type: "data" as const,
          data: prop,
        };
      }
    };
    const isValidProps = (name: string) => {
      return !["children", "key"].includes(name) && viewData.props[name] !== undefined;
    };
    const newPropsNames = Object.keys(viewData.props);
    if (!existingView) {
      const newView: ExistingSharedViewData = {
        ...viewData,
        props: newPropsNames.filter(isValidProps).map(mapProps),
      };
      existingSharedViewsRef.current.push(newView);
      server.emit("update_view", {
        view: {
          ...newView,
          props: {
            delete: [],
            merge: [],
            create: newView.props,
          },
        },
      });
      return;
    }
    const propsToDelete = (existingView?.props || []).filter(
      (propName) => viewData.props[propName.name] === undefined
    );
    propsToDelete.forEach((prop) => {
      Reflect.deleteProperty(existingView.props as any, prop.name);
    });
    const boundExistingProps = (name: string) => {
      const existing = existingView && existingView.props.find((prop) => prop.name === name);
      if (!existing) {
        existingView.props.push(mapProps(name));
        return true;
      }
      if (existing.type === "data") {
        if (!deeplyEqual(existing.data, viewData.props[name])) {
          existing.data = viewData.props[name];
          return true;
        }
        return false;
      }
      if (existing.type === "event") {
        if (typeof viewData.props[name] === "function") {
          viewEventsRef.current.set(existing.uid, viewData.props[name]);
          return false;
        }
        existingView.props = existingView.props.filter((prop) => prop.name !== name);
        existingView.props.push(mapProps(name));
        return true;
      }
      return false;
    };
    const propsToAdd = newPropsNames.filter(
      (name) => {
        if (!isValidProps(name)) {
          return false;
        }
        return boundExistingProps(name);
      }
    ).map((name) => {
      return existingView.props.find((prop) => prop.name === name);
    }).filter(Boolean) as Prop[];
    if (propsToAdd.length === 0 && propsToDelete.length === 0) {
      return;
    }
    if (propsToAdd.length > 0 || propsToDelete.length > 0) {
      server.emit("update_view", {
        view: {
          ...existingView,
          props: {
            create: propsToAdd,
            delete: propsToDelete.map((prop) => prop.name),
            merge: [],
          },
        },
      });
    }
  }, [registerViewEvent]);

  const deleteRunningView = useCallback((uid: string) => {
    const runningViewIndex = existingSharedViewsRef.current.findIndex(
      (view) => view.uid === uid
    );
    if (runningViewIndex !== -1) {
      const deletedView = existingSharedViewsRef.current.splice(
        runningViewIndex,
        1
      )[0];
      deletedView.props.forEach(
        (prop) => prop.type === "event" && viewEventsRef.current.delete(prop.uid)
      );
      const server = serverRef.current;
      if (!server) {
        return;
      }
      server.emit("delete_view", { viewUid: uid });
    }
  }, []);

  // componentDidMount equivalent
  useEffect(() => {
    if (transportIsClient) {
      addClient(transport);
    }
  }, [transportIsClient, transport, addClient]);

  // componentWillUnmount equivalent
  useEffect(() => {
    return () => {
      cleanUpFunctionsRef.current.forEach((f) => f());
    };
  }, []);

  // Expose methods via ref for Server component
  useImperativeHandle(ref, () => ({
    views: existingSharedViewsRef.current,
    addClient,
    removeClient,
  }), [addClient, removeClient]);

  const contextValue = useMemo<AppContextValue>(() => ({
    views: existingSharedViewsRef.current,
    addClient,
    removeClient,
    updateRunningView,
    deleteRunningView,
  }), [addClient, removeClient, updateRunningView, deleteRunningView]);

  if (paused) {
    return null;
  }

  return (
    <AppContext.Provider value={contextValue}>
      {children()}
    </AppContext.Provider>
  );
});

export default App;
