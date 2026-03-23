import React, { useRef, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle, type ReactNode } from "react";
import { AppContext, type AppContextValue } from "./contexts";
import type {
  ViewData,
  ExistingSharedViewData,
  Prop,
  Transport,
  AppEvents,
  SerializableValue,
  DataProp,
} from "../shared/types";
import type { EventUid, ViewUid, StreamUid } from "../shared/branded.types";
import { createEventUid, createPropName } from "../shared/branded.types";
import type { StreamEmitterHandle } from "../shared/view-inference";
import { getViewDef } from "./utils";
import type { DecompileTransport } from "../shared/decompiled-transport";
import { decompileTransport } from "../shared/decompiled-transport";
import { randomId } from "../shared/id";
import { deeplyEqual } from "../shared/comparison.utils";

/**
 * Event handler type for registered view events.
 */
type EventHandler = (...args: ReadonlyArray<SerializableValue>) => SerializableValue | Promise<SerializableValue>;

interface AppProps<TEvents extends Record<string | number, unknown> = Record<string, unknown>> {
  readonly children: () => ReactNode;
  readonly transport: Transport<TEvents>;
  readonly paused: boolean;
  readonly transportIsClient: boolean;
}

export interface AppHandle {
  readonly views: ReadonlyArray<ExistingSharedViewData>;
  readonly addClient: <TClientEvents extends Record<string | number, unknown>>(client: Transport<TClientEvents>) => void;
  readonly removeClient: <TClientEvents extends Record<string | number, unknown>>(client: Transport<TClientEvents>) => void;
}

function snapshotViews(views: ReadonlyArray<ExistingSharedViewData>): ReadonlyArray<ExistingSharedViewData> {
  return views.map((view) => ({
    uid: view.uid,
    name: view.name,
    parentUid: view.parentUid,
    childIndex: view.childIndex,
    isRoot: view.isRoot,
    props: [...view.props],
  }));
}

const App = forwardRef<AppHandle, AppProps<Record<string | number, unknown>>>(function App({ children, transport, paused, transportIsClient }, ref) {
  const serverRef = useRef<DecompileTransport>(decompileTransport(transport));
  const clientsRef = useRef<ReadonlyArray<DecompileTransport>>([]);
  const clientsMapRef = useRef<Map<Transport<Record<string | number, unknown>>, DecompileTransport>>(new Map());
  const existingSharedViewsRef = useRef<ReadonlyArray<ExistingSharedViewData>>([]);
  const viewEventsRef = useRef<ReadonlyMap<EventUid, EventHandler>>(new Map());
  const cleanUpFunctionsRef = useRef<ReadonlyArray<() => void>>([]);

  const registerViewEvent = useCallback((event: EventHandler): EventUid => {
    const eventUid = createEventUid(randomId());
    viewEventsRef.current = new Map([...viewEventsRef.current, [eventUid, event]]);
    return eventUid;
  }, []);

  const broadcastStreamChunk = useCallback((streamUid: StreamUid, chunk: SerializableValue): void => {
    const server = serverRef.current;
    if (!server) return;
    const payload = { streamUid, chunk };
    server.emit("stream_chunk", payload);
    for (const client of clientsRef.current) {
      client.emit("stream_chunk", payload);
    }
  }, []);

  const broadcastStreamEnd = useCallback((streamUid: StreamUid): void => {
    const server = serverRef.current;
    if (!server) return;
    const payload = { streamUid };
    server.emit("stream_end", payload);
    for (const client of clientsRef.current) {
      client.emit("stream_end", payload);
    }
  }, []);

  const registerSocketListener = useCallback((client: DecompileTransport) => {
    const requestViewsTreeHandler = (): void => {
      client.emit("update_views_tree", { views: snapshotViews(existingSharedViewsRef.current) });
    };
    const cleanReqTree = client.on("request_views_tree", requestViewsTreeHandler);

    const requestEventHandler = ({
      eventArguments,
      eventUid: requestedEventUid,
      uid: currentEventUid,
    }: AppEvents['request_event']): void => {
      const handler = viewEventsRef.current.get(requestedEventUid);
      if (!handler) {
        throw new Error(
          "the client is trying to access an event that does not exist"
        );
      }
      Promise.resolve(handler(...eventArguments)).then((result) => {
        client.emit("respond_to_event", {
          data: result,
          uid: currentEventUid,
          eventUid: requestedEventUid,
        });
      });
    };
    const cleanReqEvent = client.on("request_event", requestEventHandler);

    cleanUpFunctionsRef.current = [...cleanUpFunctionsRef.current, () => {
      cleanReqTree?.();
      cleanReqEvent?.();
    }];
  }, []);

  const addClient = useCallback(<TClientEvents extends Record<string | number, unknown>>(client: Transport<TClientEvents>) => {
    const clientTransport = decompileTransport(client);
    clientsMapRef.current.set(client as unknown as Transport<Record<string | number, unknown>>, clientTransport);
    clientsRef.current = Array.from(clientsMapRef.current.values());
    registerSocketListener(clientTransport);
  }, [registerSocketListener]);

  const removeClient = useCallback(<TClientEvents extends Record<string | number, unknown>>(client: Transport<TClientEvents>) => {
    clientsMapRef.current.delete(client as unknown as Transport<Record<string | number, unknown>>);
    clientsRef.current = Array.from(clientsMapRef.current.values());
  }, []);

  const updateRunningView = useCallback((viewData: ViewData) => {
    const server = serverRef.current;
    if (!server) {
      return;
    }

    const existingViewIndex = existingSharedViewsRef.current.findIndex(
      (view) => view.uid === viewData.uid
    );
    const existingView = existingViewIndex >= 0 ? existingSharedViewsRef.current[existingViewIndex] : undefined;

    const viewDef = getViewDef(viewData.name);

    const mapProps = (name: string): Prop => {
      const prop = viewData.props[name];

      if (viewDef?.streams[name]) {
        return {
          name: createPropName(name),
          type: "stream" as const,
          uid: (prop as unknown as StreamEmitterHandle).uid,
        };
      }

      if (viewDef?.callbacks[name] || typeof prop === "function") {
        return {
          name: createPropName(name),
          type: "event" as const,
          uid: registerViewEvent(prop as EventHandler),
        };
      }

      return {
        name: createPropName(name),
        type: "data" as const,
        data: prop as SerializableValue,
      };
    };

    const isValidProp = (name: string): boolean => {
      return !["children", "key"].includes(name) && viewData.props[name] !== undefined;
    };

    const newPropsNames = Object.keys(viewData.props);

    if (!existingView) {
      const newProps = newPropsNames.filter(isValidProp).map(mapProps);
      const newView: ExistingSharedViewData = {
        uid: viewData.uid,
        name: viewData.name,
        parentUid: viewData.parentUid,
        childIndex: viewData.childIndex,
        isRoot: viewData.isRoot,
        props: newProps,
      };
      existingSharedViewsRef.current = [...existingSharedViewsRef.current, newView];
      const updatePayload = {
        view: {
          uid: newView.uid,
          name: newView.name,
          parentUid: newView.parentUid,
          childIndex: newView.childIndex,
          isRoot: newView.isRoot,
          props: {
            delete: [],
            create: newProps,
          },
        },
      };
      server.emit("update_view", updatePayload);
      for (const client of clientsRef.current) {
        client.emit("update_view", updatePayload);
      }
      return;
    }

    const propsToDelete = existingView.props.filter(
      (propName) => viewData.props[propName.name as string] === undefined
    );

    // Build new props array immutably
    let currentProps = existingView.props.filter(
      (prop) => viewData.props[prop.name as string] !== undefined
    );

    const propsToAdd: Prop[] = [];

    for (const name of newPropsNames) {
      if (!isValidProp(name)) {
        continue;
      }

      const propName = createPropName(name);
      const existingPropIndex = currentProps.findIndex((prop) => prop.name === propName);
      const existingProp = existingPropIndex >= 0 ? currentProps[existingPropIndex] : undefined;

      if (!existingProp) {
        const newProp = mapProps(name);
        currentProps = [...currentProps, newProp];
        propsToAdd.push(newProp);
        continue;
      }

      if (existingProp.type === "data") {
        const dataValue = viewData.props[name];
        if (!deeplyEqual(existingProp.data, dataValue as SerializableValue)) {
          const updatedProp: DataProp = {
            name: propName,
            type: "data" as const,
            data: dataValue as SerializableValue,
          };
          currentProps = [
            ...currentProps.slice(0, existingPropIndex),
            updatedProp,
            ...currentProps.slice(existingPropIndex + 1),
          ];
          propsToAdd.push(updatedProp);
        }
        continue;
      }

      if (existingProp.type === "stream") {
        // Stream props keep the same UID — no update needed
        continue;
      }

      if (existingProp.type === "event") {
        const propValue = viewData.props[name];
        if (typeof propValue === "function") {
          // Update the event handler in the registry
          viewEventsRef.current = new Map([
            ...viewEventsRef.current,
            [existingProp.uid, propValue as EventHandler],
          ]);
        } else {
          // Event changed to data prop
          const filteredProps = currentProps.filter((prop) => prop.name !== propName);
          const newProp = mapProps(name);
          currentProps = [...filteredProps, newProp];
          propsToAdd.push(newProp);
        }
      }
    }

    // Replace the view immutably in the ref
    const updatedView: ExistingSharedViewData = { ...existingView, props: currentProps };
    existingSharedViewsRef.current = [
      ...existingSharedViewsRef.current.slice(0, existingViewIndex),
      updatedView,
      ...existingSharedViewsRef.current.slice(existingViewIndex + 1),
    ];

    if (propsToAdd.length === 0 && propsToDelete.length === 0) {
      return;
    }

    const updatePayload = {
      view: {
        uid: existingView.uid,
        name: existingView.name,
        parentUid: existingView.parentUid,
        childIndex: existingView.childIndex,
        isRoot: existingView.isRoot,
        props: {
          create: propsToAdd,
          delete: propsToDelete.map((prop) => prop.name),
        },
      },
    };
    server.emit("update_view", updatePayload);
    for (const client of clientsRef.current) {
      client.emit("update_view", updatePayload);
    }
  }, [registerViewEvent]);

  const deleteRunningView = useCallback((uid: ViewUid) => {
    const runningViewIndex = existingSharedViewsRef.current.findIndex(
      (view) => view.uid === uid
    );
    if (runningViewIndex === -1) return;

    const deletedView = existingSharedViewsRef.current[runningViewIndex];
    if (!deletedView) return;

    existingSharedViewsRef.current = [
      ...existingSharedViewsRef.current.slice(0, runningViewIndex),
      ...existingSharedViewsRef.current.slice(runningViewIndex + 1),
    ];

    // Clean up event handlers for deleted view
    const eventUidsToDelete = deletedView.props
      .filter((prop): prop is Prop & { type: 'event' } => prop.type === "event")
      .map((prop) => prop.uid);

    const newEventsMap = new Map(viewEventsRef.current);
    for (const eventUid of eventUidsToDelete) {
      newEventsMap.delete(eventUid);
    }
    viewEventsRef.current = newEventsMap;

    const server = serverRef.current;
    if (!server) return;

    const deletePayload = { viewUid: uid };
    server.emit("delete_view", deletePayload);
    for (const client of clientsRef.current) {
      client.emit("delete_view", deletePayload);
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
      for (const cleanup of cleanUpFunctionsRef.current) {
        cleanup();
      }
    };
  }, []);

  // Expose methods via ref for Server component
  useImperativeHandle(ref, () => ({
    views: snapshotViews(existingSharedViewsRef.current),
    addClient,
    removeClient,
  }), [addClient, removeClient]);

  const contextValue = useMemo<AppContextValue>(() => ({
    views: snapshotViews(existingSharedViewsRef.current),
    addClient,
    removeClient,
    updateRunningView,
    deleteRunningView,
    broadcastStreamChunk,
    broadcastStreamEnd,
  }), [addClient, removeClient, updateRunningView, deleteRunningView, broadcastStreamChunk, broadcastStreamEnd]);

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
