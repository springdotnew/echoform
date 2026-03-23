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
import type { EventUid, ViewUid, StreamUid, PropName } from "../shared/branded.types";
import { createEventUid, createPropName } from "../shared/branded.types";
import type { StreamEmitterHandle } from "../shared/view-inference";
import { getViewDef } from "./utils";
import type { DecompileTransport } from "../shared/decompiled-transport";
import { decompileTransport } from "../shared/decompiled-transport";
import { randomId } from "../shared/id";
import { deeplyEqual } from "../shared/comparison.utils";
import { validateSchema } from "../shared/validation";
import type { CallbackDef, ViewDef } from "../shared/view-builder";
import type { StandardSchemaV1 } from "../shared/standard-schema";

// ── Types ──

type AnyTransport = Transport<Record<string | number, unknown>>;
type EventHandler = (...args: ReadonlyArray<SerializableValue>) => SerializableValue | Promise<SerializableValue>;

interface RegisteredEvent {
  readonly handler: EventHandler;
  readonly callbackDef?: CallbackDef;
}

interface AppProps {
  readonly children: () => ReactNode;
  readonly transport: Transport<Record<string | number, unknown>>;
  readonly paused: boolean;
  readonly transportIsClient: boolean;
}

export interface AppHandle {
  readonly views: ReadonlyArray<ExistingSharedViewData>;
  readonly addClient: <T extends Record<string | number, unknown>>(client: Transport<T>) => void;
  readonly removeClient: <T extends Record<string | number, unknown>>(client: Transport<T>) => void;
}

// ── Helpers (pure, outside component) ──

const IGNORED_PROPS = new Set(["children", "key"]);

function snapshotViews(views: ReadonlyArray<ExistingSharedViewData>): ReadonlyArray<ExistingSharedViewData> {
  return views.map((view) => ({ ...view, props: [...view.props] }));
}

function classifyProp(
  name: string,
  value: unknown,
  viewDef: ViewDef | undefined,
  registerEvent: (handler: EventHandler, cbDef?: CallbackDef) => EventUid,
): Prop {
  if (viewDef?.streams[name]) {
    return { name: createPropName(name), type: "stream", uid: (value as StreamEmitterHandle).uid };
  }

  if (viewDef?.callbacks[name] || typeof value === "function") {
    const cbDef = viewDef?.callbacks[name] as CallbackDef | undefined;
    return { name: createPropName(name), type: "event", uid: registerEvent(value as EventHandler, cbDef) };
  }

  if (viewDef?.input[name]) {
    validateSchema(viewDef.input[name] as StandardSchemaV1, value, `data prop "${name}"`);
  }

  return { name: createPropName(name), type: "data", data: value as SerializableValue };
}

function buildViewPayload(view: ExistingSharedViewData, create: ReadonlyArray<Prop>, del: ReadonlyArray<PropName>) {
  return {
    view: {
      uid: view.uid, name: view.name, parentUid: view.parentUid,
      childIndex: view.childIndex, isRoot: view.isRoot,
      props: { create, delete: del },
    },
  };
}

function reconcileExistingProp(
  existingProp: Prop,
  name: string,
  propName: PropName,
  value: unknown,
  viewDef: ViewDef | undefined,
  viewEventsRef: React.RefObject<ReadonlyMap<EventUid, RegisteredEvent>>,
): { updated: Prop | null } {
  if (existingProp.type === "data") {
    if (!deeplyEqual(existingProp.data, value as SerializableValue)) {
      const updatedProp: DataProp = { name: propName, type: "data", data: value as SerializableValue };
      return { updated: updatedProp };
    }
    return { updated: null };
  }

  if (existingProp.type === "stream") {
    return { updated: null };
  }

  if (existingProp.type === "event" && typeof value === "function") {
    const existingRegistered = viewEventsRef.current.get(existingProp.uid);
    const cbDef = (viewDef?.callbacks[name] as CallbackDef | undefined) ?? existingRegistered?.callbackDef;
    viewEventsRef.current = new Map([
      ...viewEventsRef.current,
      [existingProp.uid, { handler: value as EventHandler, callbackDef: cbDef }],
    ]);
    return { updated: null };
  }

  return { updated: null };
}

function reconcileProps(
  existingProps: ReadonlyArray<Prop>,
  propNames: ReadonlyArray<string>,
  viewData: ViewData,
  viewDef: ViewDef | undefined,
  registerEvent: (handler: EventHandler, cbDef?: CallbackDef) => EventUid,
  viewEventsRef: React.RefObject<ReadonlyMap<EventUid, RegisteredEvent>>,
): { readonly currentProps: ReadonlyArray<Prop>; readonly propsToAdd: ReadonlyArray<Prop> } {
  let current = existingProps.filter((prop) => viewData.props[prop.name as string] !== undefined);
  const toAdd: Prop[] = [];

  for (const name of propNames) {
    const propName = createPropName(name);
    const existingPropIndex = current.findIndex((prop) => prop.name === propName);

    if (existingPropIndex < 0) {
      const newProp = classifyProp(name, viewData.props[name], viewDef, registerEvent);
      current = [...current, newProp];
      toAdd.push(newProp);
      continue;
    }

    const { updated } = reconcileExistingProp(current[existingPropIndex]!, name, propName, viewData.props[name], viewDef, viewEventsRef);
    if (updated) {
      current = replaceAt(current, existingPropIndex, updated);
      toAdd.push(updated);
    }
  }

  return { currentProps: current, propsToAdd: toAdd };
}

function replaceAt<T>(arr: ReadonlyArray<T>, index: number, item: T): T[] {
  return [...arr.slice(0, index), item, ...arr.slice(index + 1)];
}

function removeAt<T>(arr: ReadonlyArray<T>, index: number): T[] {
  return [...arr.slice(0, index), ...arr.slice(index + 1)];
}

// ── Component ──

const App = forwardRef<AppHandle, AppProps>(function App({ children, transport, paused, transportIsClient }, ref) {
  const serverRef = useRef<DecompileTransport>(decompileTransport(transport));
  const clientsRef = useRef<ReadonlyArray<DecompileTransport>>([]);
  const clientsMapRef = useRef<Map<Transport<Record<string | number, unknown>>, DecompileTransport>>(new Map());
  const existingSharedViewsRef = useRef<ReadonlyArray<ExistingSharedViewData>>([]);
  const viewEventsRef = useRef<ReadonlyMap<EventUid, RegisteredEvent>>(new Map());
  const cleanUpFunctionsRef = useRef<ReadonlyArray<() => void>>([]);

  const registerViewEvent = useCallback((event: EventHandler, callbackDef?: CallbackDef): EventUid => {
    const eventUid = createEventUid(randomId());
    viewEventsRef.current = new Map([...viewEventsRef.current, [eventUid, { handler: event, callbackDef }]]);
    return eventUid;
  }, []);

  const broadcast = useCallback(<Key extends keyof AppEvents>(event: Key, data: AppEvents[Key]): void => {
    const server = serverRef.current;
    if (!server) return;
    server.emit(event, data);
    for (const client of clientsRef.current) {
      client.emit(event, data);
    }
  }, []);

  const broadcastStreamChunk = useCallback((streamUid: StreamUid, chunk: SerializableValue): void => {
    broadcast("stream_chunk", { streamUid, chunk });
  }, [broadcast]);

  const broadcastStreamEnd = useCallback((streamUid: StreamUid): void => {
    broadcast("stream_end", { streamUid });
  }, [broadcast]);

  const registerSocketListener = useCallback((client: DecompileTransport) => {
    const cleanReqTree = client.on("request_views_tree", () => {
      client.emit("update_views_tree", { views: snapshotViews(existingSharedViewsRef.current) });
    });

    const cleanReqEvent = client.on("request_event", ({
      eventArguments, eventUid: requestedEventUid, uid: currentEventUid,
    }: AppEvents['request_event']) => {
      const registered = viewEventsRef.current.get(requestedEventUid);
      if (!registered) {
        throw new Error("the client is trying to access an event that does not exist");
      }

      if (registered.callbackDef?.input) {
        const argValue = eventArguments.length === 1 ? eventArguments[0] : eventArguments;
        validateSchema(registered.callbackDef.input as StandardSchemaV1, argValue, `callback ${requestedEventUid as string}`);
      }

      Promise.resolve(registered.handler(...eventArguments)).then((result) => {
        client.emit("respond_to_event", { data: result, uid: currentEventUid, eventUid: requestedEventUid });
      });
    });

    cleanUpFunctionsRef.current = [...cleanUpFunctionsRef.current, () => { cleanReqTree?.(); cleanReqEvent?.(); }];
  }, []);

  const addClient = useCallback(<T extends Record<string | number, unknown>>(client: Transport<T>) => {
    const clientTransport = decompileTransport(client);
    const key = client as unknown as AnyTransport;
    clientsMapRef.current = new Map([...clientsMapRef.current, [key, clientTransport]]);
    clientsRef.current = Array.from(clientsMapRef.current.values());
    registerSocketListener(clientTransport);
  }, [registerSocketListener]);

  const removeClient = useCallback(<T extends Record<string | number, unknown>>(client: Transport<T>) => {
    const key = client as unknown as AnyTransport;
    const newMap = new Map(clientsMapRef.current);
    newMap.delete(key);
    clientsMapRef.current = newMap;
    clientsRef.current = Array.from(clientsMapRef.current.values());
  }, []);

  const updateRunningView = useCallback((viewData: ViewData) => {
    if (!serverRef.current) return;

    const viewDef = getViewDef(viewData.name);
    const propNames = Object.keys(viewData.props).filter((propName) => !IGNORED_PROPS.has(propName) && viewData.props[propName] !== undefined);

    const existingViewIndex = existingSharedViewsRef.current.findIndex((v) => v.uid === viewData.uid);
    const existingView = existingViewIndex >= 0 ? existingSharedViewsRef.current[existingViewIndex] : undefined;

    if (!existingView) {
      const props = propNames.map((name) => classifyProp(name, viewData.props[name], viewDef, registerViewEvent));
      const newView: ExistingSharedViewData = {
        uid: viewData.uid, name: viewData.name, parentUid: viewData.parentUid,
        childIndex: viewData.childIndex, isRoot: viewData.isRoot, props,
      };
      existingSharedViewsRef.current = [...existingSharedViewsRef.current, newView];
      broadcast("update_view", buildViewPayload(newView, props, []));
      return;
    }

    const propsToDelete = existingView.props.filter((prop) => viewData.props[prop.name as string] === undefined);
    const { currentProps, propsToAdd } = reconcileProps(
      existingView.props, propNames, viewData, viewDef, registerViewEvent, viewEventsRef,
    );

    existingSharedViewsRef.current = replaceAt(existingSharedViewsRef.current, existingViewIndex, { ...existingView, props: currentProps });

    if (propsToAdd.length > 0 || propsToDelete.length > 0) {
      broadcast("update_view", buildViewPayload(existingView, propsToAdd, propsToDelete.map((prop) => prop.name)));
    }
  }, [registerViewEvent, broadcast]);

  const deleteRunningView = useCallback((uid: ViewUid) => {
    const viewIndex = existingSharedViewsRef.current.findIndex((v) => v.uid === uid);
    if (viewIndex === -1) return;

    const deletedView = existingSharedViewsRef.current[viewIndex];
    if (!deletedView) return;

    existingSharedViewsRef.current = removeAt(existingSharedViewsRef.current, viewIndex);

    const deleteSet = new Set(
      deletedView.props.filter((prop): prop is Prop & { type: 'event' } => prop.type === "event").map((prop) => prop.uid),
    );
    viewEventsRef.current = new Map([...viewEventsRef.current].filter(([key]) => !deleteSet.has(key)));

    broadcast("delete_view", { viewUid: uid });
  }, [broadcast]);

  useEffect(() => {
    if (transportIsClient) {
      registerSocketListener(serverRef.current);
    }
  }, [transportIsClient, transport, addClient]);

  useEffect(() => {
    return () => { for (const cleanup of cleanUpFunctionsRef.current) cleanup(); };
  }, []);

  useImperativeHandle(ref, () => ({
    views: snapshotViews(existingSharedViewsRef.current),
    addClient,
    removeClient,
  }), [addClient, removeClient]);

  const contextValue = useMemo<AppContextValue>(() => ({
    views: snapshotViews(existingSharedViewsRef.current),
    addClient, removeClient, updateRunningView, deleteRunningView,
    broadcastStreamChunk, broadcastStreamEnd,
  }), [addClient, removeClient, updateRunningView, deleteRunningView, broadcastStreamChunk, broadcastStreamEnd]);

  if (paused) return null;

  return (
    <AppContext.Provider value={contextValue}>
      {children()}
    </AppContext.Provider>
  );
});

export default App;
