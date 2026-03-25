import React, { useRef, useEffect, useCallback, useMemo, forwardRef, useImperativeHandle, type ReactNode } from "react";
import { AppContext, type AppContextValue } from "./contexts";
import type {
  ViewData,
  ExistingSharedViewData,
  Prop,
  Transport,
  AnyTransport,
  AppEvents,
  SerializableValue,
  DataProp,
} from "../shared/types";
import type { EventUid, RequestUid, ViewUid, StreamUid, PropName } from "../shared/branded.types";
import { createEventUid, createPropName } from "../shared/branded.types";
import type { StreamEmitterHandle } from "../shared/view-inference";
import { getViewDef } from "../shared/view-builder";
import { ViewFactoryContext } from "../shared/view-factory";
import type { ViewFactory } from "../shared/view-factory";
import ViewComponent from "./ViewComponent";
import type { DecompileTransport } from "../shared/decompiled-transport";
import { decompileTransport } from "../shared/decompiled-transport";
import { randomId } from "../shared/id";
import { deeplyEqual } from "../shared/comparison.utils";
import { validateSchema, validateSchemaStrict } from "../shared/validation";
import type { ValidationResult } from "../shared/validation";
import type { CallbackDef, ViewDef } from "../shared/view-builder";
import type { StandardSchemaV1 } from "../shared/standard-schema";

type EventHandler = (...args: ReadonlyArray<SerializableValue>) => SerializableValue | Promise<SerializableValue>;

interface RegisteredEvent {
  readonly handler: EventHandler;
  readonly callbackDef?: CallbackDef | undefined;
}

interface AppProps {
  readonly children: () => ReactNode;
  readonly transport: Transport<Record<string | number, unknown>>;
  readonly paused: boolean;
  readonly transportIsClient: boolean;
  readonly skipCallbackValidation?: boolean;
}

export interface AppHandle {
  readonly views: ReadonlyArray<ExistingSharedViewData>;
  readonly addClient: <T extends Record<string | number, unknown>>(client: Transport<T>) => void;
  readonly removeClient: <T extends Record<string | number, unknown>>(client: Transport<T>) => void;
}

interface ViewReconcileContext {
  readonly registerViewEvent: (handler: EventHandler, cbDef?: CallbackDef) => EventUid;
  readonly viewEventsRef: React.RefObject<ReadonlyMap<EventUid, RegisteredEvent>>;
  readonly existingSharedViewsRef: React.RefObject<ReadonlyArray<ExistingSharedViewData>>;
  readonly clientEventAuthRef: React.RefObject<Map<DecompileTransport, Set<EventUid>>>;
  readonly broadcast: <Key extends keyof AppEvents>(event: Key, data: AppEvents[Key]) => void;
}

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
  const filtered = existingProps.filter((prop) => viewData.props[prop.name as string] !== undefined);

  return propNames.reduce<{ readonly currentProps: ReadonlyArray<Prop>; readonly propsToAdd: ReadonlyArray<Prop> }>(
    (acc, name) => {
      const propName = createPropName(name);
      const existingPropIndex = acc.currentProps.findIndex((prop) => prop.name === propName);

      if (existingPropIndex < 0) {
        const newProp = classifyProp(name, viewData.props[name], viewDef, registerEvent);
        return { currentProps: [...acc.currentProps, newProp], propsToAdd: [...acc.propsToAdd, newProp] };
      }

      const { updated } = reconcileExistingProp(acc.currentProps[existingPropIndex]!, name, propName, viewData.props[name], viewDef, viewEventsRef);
      if (updated) {
        return { currentProps: replaceAt(acc.currentProps, existingPropIndex, updated), propsToAdd: [...acc.propsToAdd, updated] };
      }
      return acc;
    },
    { currentProps: filtered, propsToAdd: [] },
  );
}

function collectEventUids(props: ReadonlyArray<Prop>): ReadonlyArray<EventUid> {
  return props.filter((prop): prop is Prop & { type: 'event' } => prop.type === "event").map((prop) => prop.uid);
}

function mapAuthSets(
  authMap: Map<DecompileTransport, Set<EventUid>>,
  transform: (authSet: Set<EventUid>) => Set<EventUid>,
): Map<DecompileTransport, Set<EventUid>> {
  const result = new Map<DecompileTransport, Set<EventUid>>();
  for (const [client, authSet] of authMap) {
    result.set(client, transform(authSet));
  }
  return result;
}

function authorizeEventUidsForAllClients(
  authMap: Map<DecompileTransport, Set<EventUid>>,
  uids: ReadonlyArray<EventUid>,
): Map<DecompileTransport, Set<EventUid>> {
  return mapAuthSets(authMap, (authSet) => new Set([...authSet, ...uids]));
}

function deauthorizeEventUidsForAllClients(
  authMap: Map<DecompileTransport, Set<EventUid>>,
  uids: ReadonlySet<EventUid>,
): Map<DecompileTransport, Set<EventUid>> {
  return mapAuthSets(authMap, (authSet) => new Set([...authSet].filter((uid) => !uids.has(uid))));
}

function removeEventHandlers(
  viewEventsRef: React.RefObject<ReadonlyMap<EventUid, RegisteredEvent>>,
  eventUids: ReadonlySet<EventUid>,
): void {
  viewEventsRef.current = new Map([...viewEventsRef.current].filter(([eventUid]) => !eventUids.has(eventUid)));
}

function emitEventResponse(
  client: DecompileTransport,
  uid: RequestUid,
  eventUid: EventUid,
  data: SerializableValue | null,
  error?: string,
): void {
  client.emit("respond_to_event", error !== undefined
    ? { data, uid, eventUid, error }
    : { data, uid, eventUid });
}

function validateAndExecute(
  client: DecompileTransport,
  currentEventUid: RequestUid,
  requestedEventUid: EventUid,
  eventArguments: ReadonlyArray<SerializableValue>,
  registered: RegisteredEvent,
  executeHandler: () => Promise<void>,
): Promise<void> {
  const argValue = eventArguments.length === 1 ? eventArguments[0] : eventArguments;
  const validationResult = validateSchemaStrict(
    registered.callbackDef!.input as StandardSchemaV1, argValue, `callback ${requestedEventUid as string}`,
  );

  const handleResult = (result: ValidationResult): Promise<void> => {
    if (!result.valid) {
      emitEventResponse(client, currentEventUid, requestedEventUid, null, "Invalid callback input");
      return Promise.resolve();
    }
    return executeHandler();
  };

  if (validationResult instanceof Promise) return validationResult.then(handleResult);
  return handleResult(validationResult);
}

function processEventRequest(
  client: DecompileTransport,
  eventData: AppEvents['request_event'],
  viewEventsRef: React.RefObject<ReadonlyMap<EventUid, RegisteredEvent>>,
  clientEventAuthRef: React.RefObject<Map<DecompileTransport, Set<EventUid>>>,
  shouldSkipValidation: boolean,
): Promise<void> | void {
  const { eventArguments, eventUid: requestedEventUid, uid: currentEventUid } = eventData;

  const authorized = clientEventAuthRef.current.get(client);
  if (!authorized || !authorized.has(requestedEventUid)) {
    emitEventResponse(client, currentEventUid, requestedEventUid, null, "Unauthorized event access");
    return;
  }

  const registered = viewEventsRef.current.get(requestedEventUid);
  if (!registered) {
    emitEventResponse(client, currentEventUid, requestedEventUid, null, "Event does not exist");
    return;
  }

  const executeHandler = (): Promise<void> =>
    Promise.resolve(registered.handler(...eventArguments)).then((result) => {
      emitEventResponse(client, currentEventUid, requestedEventUid, result);
    });

  if (!registered.callbackDef?.input || shouldSkipValidation) return executeHandler();
  return validateAndExecute(client, currentEventUid, requestedEventUid, eventArguments, registered, executeHandler);
}

function handleViewsTreeRequest(
  client: DecompileTransport,
  existingSharedViewsRef: React.RefObject<ReadonlyArray<ExistingSharedViewData>>,
  clientEventAuthRef: React.RefObject<Map<DecompileTransport, Set<EventUid>>>,
): void {
  client.emit("update_views_tree", { views: snapshotViews(existingSharedViewsRef.current) });
  const allEventUids = existingSharedViewsRef.current.flatMap((v) => collectEventUids(v.props));
  clientEventAuthRef.current = new Map([...clientEventAuthRef.current, [client, new Set(allEventUids)]]);
}

function createNewSharedView(
  viewData: ViewData,
  propNames: ReadonlyArray<string>,
  viewDef: ViewDef | undefined,
  ctx: ViewReconcileContext,
): void {
  const props = propNames.map((name) => classifyProp(name, viewData.props[name], viewDef, ctx.registerViewEvent));
  const newView: ExistingSharedViewData = {
    uid: viewData.uid, name: viewData.name, parentUid: viewData.parentUid,
    childIndex: viewData.childIndex, isRoot: viewData.isRoot, props,
  };
  ctx.existingSharedViewsRef.current = [...ctx.existingSharedViewsRef.current, newView];
  ctx.broadcast("update_view", buildViewPayload(newView, props, []));
  ctx.clientEventAuthRef.current = authorizeEventUidsForAllClients(ctx.clientEventAuthRef.current, collectEventUids(props));
}

function reconcileExistingSharedView(
  existingView: ExistingSharedViewData,
  existingViewIndex: number,
  viewData: ViewData,
  propNames: ReadonlyArray<string>,
  viewDef: ViewDef | undefined,
  ctx: ViewReconcileContext,
): void {
  const propsToDelete = existingView.props.filter((prop) => viewData.props[prop.name as string] === undefined);
  const { currentProps, propsToAdd } = reconcileProps(existingView.props, propNames, viewData, viewDef, ctx.registerViewEvent, ctx.viewEventsRef);
  ctx.existingSharedViewsRef.current = replaceAt(ctx.existingSharedViewsRef.current, existingViewIndex, { ...existingView, props: currentProps });

  const deletedEventUids = collectEventUids(propsToDelete);
  if (deletedEventUids.length > 0) {
    const deletedSet = new Set(deletedEventUids);
    removeEventHandlers(ctx.viewEventsRef, deletedSet);
    ctx.clientEventAuthRef.current = deauthorizeEventUidsForAllClients(ctx.clientEventAuthRef.current, deletedSet);
  }

  if (propsToAdd.length > 0 || propsToDelete.length > 0) {
    ctx.broadcast("update_view", buildViewPayload(existingView, propsToAdd, propsToDelete.map((prop) => prop.name)));
    ctx.clientEventAuthRef.current = authorizeEventUidsForAllClients(ctx.clientEventAuthRef.current, collectEventUids(propsToAdd));
  }
}

function replaceAt<T>(items: ReadonlyArray<T>, index: number, item: T): T[] {
  return [...items.slice(0, index), item, ...items.slice(index + 1)];
}

function removeAt<T>(items: ReadonlyArray<T>, index: number): T[] {
  return [...items.slice(0, index), ...items.slice(index + 1)];
}

const App = forwardRef<AppHandle, AppProps>(function App({ children, transport, paused, transportIsClient, skipCallbackValidation }, ref) {
  const serverRef = useRef<DecompileTransport>(decompileTransport(transport));
  const clientsRef = useRef<ReadonlyArray<DecompileTransport>>([]);
  const clientsMapRef = useRef<Map<Transport<Record<string | number, unknown>>, DecompileTransport>>(new Map());
  const existingSharedViewsRef = useRef<ReadonlyArray<ExistingSharedViewData>>([]);
  const viewEventsRef = useRef<ReadonlyMap<EventUid, RegisteredEvent>>(new Map());
  const cleanUpFunctionsRef = useRef<ReadonlyArray<() => void>>([]);
  const clientCleanupMapRef = useRef<Map<AnyTransport, () => void>>(new Map());
  const clientEventAuthRef = useRef<Map<DecompileTransport, Set<EventUid>>>(new Map());
  const eventChainRef = useRef(Promise.resolve());
  const skipValidationRef = useRef(skipCallbackValidation ?? false);
  skipValidationRef.current = skipCallbackValidation ?? false;

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
      handleViewsTreeRequest(client, existingSharedViewsRef, clientEventAuthRef);
    });

    const cleanReqEvent = client.on("request_event", (eventData: AppEvents['request_event']) => {
      const shouldSkipValidation = skipValidationRef.current;
      eventChainRef.current = eventChainRef.current.then(() =>
        processEventRequest(client, eventData, viewEventsRef, clientEventAuthRef, shouldSkipValidation)
      ).catch((handlerError) => {
        console.error("echoform: event handler error", handlerError);
        emitEventResponse(client, eventData.uid, eventData.eventUid, null, "Event handler error");
      });
    });

    const cleanup = (): void => { cleanReqTree?.(); cleanReqEvent?.(); };
    cleanUpFunctionsRef.current = [...cleanUpFunctionsRef.current, cleanup];
    return cleanup;
  }, []);

  const addClient = useCallback(<T extends Record<string | number, unknown>>(client: Transport<T>) => {
    const clientTransport = decompileTransport(client);
    const transportKey = client as unknown as AnyTransport;
    clientsMapRef.current = new Map([...clientsMapRef.current, [transportKey, clientTransport]]);
    clientsRef.current = Array.from(clientsMapRef.current.values());
    clientEventAuthRef.current = new Map([...clientEventAuthRef.current, [clientTransport, new Set<EventUid>()]]);
    const cleanup = registerSocketListener(clientTransport);
    clientCleanupMapRef.current = new Map([...clientCleanupMapRef.current, [transportKey, cleanup]]);
  }, [registerSocketListener]);

  const removeClient = useCallback(<T extends Record<string | number, unknown>>(client: Transport<T>) => {
    const transportKey = client as unknown as AnyTransport;
    const clientTransport = clientsMapRef.current.get(transportKey);

    if (clientTransport) {
      clientTransport.destroy();
      clientEventAuthRef.current = new Map(
        [...clientEventAuthRef.current].filter(([k]) => k !== clientTransport),
      );
    }

    clientCleanupMapRef.current.get(transportKey)?.();
    clientCleanupMapRef.current = new Map(
      [...clientCleanupMapRef.current].filter(([k]) => k !== transportKey),
    );
    clientsMapRef.current = new Map(
      [...clientsMapRef.current].filter(([k]) => k !== transportKey),
    );
    clientsRef.current = Array.from(clientsMapRef.current.values());
  }, []);

  const updateRunningView = useCallback((viewData: ViewData) => {
    if (!serverRef.current) return;
    const viewDef = getViewDef(viewData.name);
    const propNames = Object.keys(viewData.props).filter((propName) => !IGNORED_PROPS.has(propName) && viewData.props[propName] !== undefined);
    const existingViewIndex = existingSharedViewsRef.current.findIndex((view) => view.uid === viewData.uid);
    const existingView = existingViewIndex >= 0 ? existingSharedViewsRef.current[existingViewIndex] : undefined;
    const ctx: ViewReconcileContext = { registerViewEvent, viewEventsRef, existingSharedViewsRef, clientEventAuthRef, broadcast };

    if (!existingView) {
      createNewSharedView(viewData, propNames, viewDef, ctx);
      return;
    }
    reconcileExistingSharedView(existingView, existingViewIndex, viewData, propNames, viewDef, ctx);
  }, [registerViewEvent, broadcast]);

  const deleteRunningView = useCallback((uid: ViewUid) => {
    const viewIndex = existingSharedViewsRef.current.findIndex((view) => view.uid === uid);
    if (viewIndex === -1) return;

    const deletedView = existingSharedViewsRef.current[viewIndex];
    if (!deletedView) return;

    existingSharedViewsRef.current = removeAt(existingSharedViewsRef.current, viewIndex);

    const deleteSet = new Set(collectEventUids(deletedView.props));
    removeEventHandlers(viewEventsRef, deleteSet);
    clientEventAuthRef.current = deauthorizeEventUidsForAllClients(clientEventAuthRef.current, deleteSet);

    broadcast("delete_view", { viewUid: uid });
  }, [broadcast]);

  useEffect(() => {
    if (!transportIsClient) return;
    clientEventAuthRef.current = new Map([...clientEventAuthRef.current, [serverRef.current, new Set<EventUid>()]]);
    const cleanup = registerSocketListener(serverRef.current);
    return cleanup;
  }, [transportIsClient, registerSocketListener]);

  useEffect(() => {
    return () => {
      for (const cleanup of cleanUpFunctionsRef.current) cleanup();
      serverRef.current.destroy();
      for (const client of clientsMapRef.current.values()) {
        client.destroy();
      }
      clientsMapRef.current = new Map();
      clientsRef.current = [];
      clientCleanupMapRef.current = new Map();
      viewEventsRef.current = new Map();
      clientEventAuthRef.current = new Map();
      existingSharedViewsRef.current = [];
    };
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

  const viewFactory = useCallback<ViewFactory>(
    (name, props) => <ViewComponent name={name} props={props} />,
    [],
  );

  if (paused) return null;

  return (
    <AppContext.Provider value={contextValue}>
      <ViewFactoryContext.Provider value={viewFactory}>
        {children()}
      </ViewFactoryContext.Provider>
    </AppContext.Provider>
  );
});

export default App;
