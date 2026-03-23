import React, { useState, useEffect, useRef, useCallback } from "react";
import type {
  ExistingSharedViewData,
  Transport,
  SerializableValue,
  AppEvents,
} from "../shared/types";
import type { EventUid, StreamUid } from "../shared/branded.types";
import { createRequestUid } from "../shared/branded.types";
import { decompileTransport } from "../shared/decompiled-transport";
import { randomId } from "../shared/id";
import { ViewsRenderer } from "../shared/ViewsRenderer";
import { stringifyWithoutCircular } from "../shared/serialization.utils";

function applyViewUpdate(
  state: ReadonlyArray<ExistingSharedViewData>,
  view: AppEvents['update_view']['view'],
): ReadonlyArray<ExistingSharedViewData> {
  const existingIndex = state.findIndex((currentView) => currentView.uid === view.uid);

  if (existingIndex < 0) {
    const newView: ExistingSharedViewData = {
      uid: view.uid, name: view.name, parentUid: view.parentUid,
      childIndex: view.childIndex, isRoot: view.isRoot, props: view.props.create,
    };
    return [...state, newView];
  }

  const existingView = state[existingIndex];
  if (!existingView) return state;

  const deletedNames = new Set(view.props.delete);
  const createNames = new Set(view.props.create.map((prop) => prop.name));
  const filteredProps = existingView.props.filter(
    (prop) => !deletedNames.has(prop.name) && !createNames.has(prop.name),
  );
  const updatedView: ExistingSharedViewData = {
    ...existingView,
    props: [...filteredProps, ...view.props.create],
  };
  return [...state.slice(0, existingIndex), updatedView, ...state.slice(existingIndex + 1)];
}

function applyViewDeletion(
  state: ReadonlyArray<ExistingSharedViewData>,
  viewUid: AppEvents['delete_view']['viewUid'],
): ReadonlyArray<ExistingSharedViewData> {
  const runningViewIndex = state.findIndex((view) => view.uid === viewUid);
  if (runningViewIndex === -1) return state;
  return [...state.slice(0, runningViewIndex), ...state.slice(runningViewIndex + 1)];
}

interface ClientProps<ViewsInterface extends Record<string, unknown> = Record<string, unknown>, TEvents extends Record<string | number, unknown> = Record<string, unknown>> {
  readonly transport: Transport<TEvents>;
  readonly views: Readonly<Record<string, React.ComponentType<ViewsInterface[keyof ViewsInterface] & Record<string, unknown>>>>;
  readonly requestViewTreeOnMount?: boolean;
}

function Client<ViewsInterface extends Record<string, unknown> = Record<string, unknown>, TEvents extends Record<string | number, unknown> = Record<string, unknown>>({
  transport: rawTransport,
  views,
  requestViewTreeOnMount = true,
}: ClientProps<ViewsInterface, TEvents>): React.ReactElement {
  const [runningViews, setRunningViews] = useState<ReadonlyArray<ExistingSharedViewData>>([]);
  const transportRef = useRef(decompileTransport(rawTransport));
  const streamListenersRef = useRef<Map<StreamUid, Set<(chunk: SerializableValue) => void>>>(new Map());

  const createEvent = useCallback((eventUid: EventUid, ...args: ReadonlyArray<SerializableValue>): Promise<SerializableValue> => {
    return new Promise((resolve) => {
      const requestUid = createRequestUid(randomId());
      const transport = transportRef.current;

      let unsubscribe: (() => void) | undefined;

      const handler = ({
        data,
        uid,
        eventUid: responseEventUid,
      }: AppEvents['respond_to_event']): void => {
        if (uid === requestUid && responseEventUid === eventUid) {
          resolve(data);
          unsubscribe?.();
        }
      };

      unsubscribe = transport.on("respond_to_event", handler) ?? undefined;

      stringifyWithoutCircular(args); // validate

      transport.emit("request_event", {
        eventArguments: args,
        eventUid: eventUid,
        uid: requestUid,
      });
    });
  }, []);

  const streamSubscribe = useCallback((streamUid: StreamUid, listener: (chunk: SerializableValue) => void): (() => void) => {
    const existing = streamListenersRef.current.get(streamUid);
    const newSet = new Set(existing);
    newSet.add(listener);
    streamListenersRef.current = new Map([...streamListenersRef.current, [streamUid, newSet]]);

    return () => {
      const current = streamListenersRef.current.get(streamUid);
      if (!current) return;
      const updated = new Set(current);
      updated.delete(listener);
      const newMap = new Map(streamListenersRef.current);
      if (updated.size === 0) {
        newMap.delete(streamUid);
      } else {
        newMap.set(streamUid, updated);
      }
      streamListenersRef.current = newMap;
    };
  }, []);

  useEffect(() => {
    const transport = transportRef.current;

    const updateViewsTreeHandler = ({ views }: AppEvents['update_views_tree']): void => {
      setRunningViews(views);
    };

    const updateViewHandler = ({ view }: AppEvents['update_view']): void => {
      setRunningViews((state) => applyViewUpdate(state, view));
    };

    const deleteViewHandler = ({ viewUid }: AppEvents['delete_view']): void => {
      setRunningViews((state) => applyViewDeletion(state, viewUid));
    };

    const streamChunkHandler = ({ streamUid, chunk }: AppEvents['stream_chunk']): void => {
      const listeners = streamListenersRef.current.get(streamUid);
      if (listeners) {
        for (const listener of listeners) {
          listener(chunk);
        }
      }
    };

    const streamEndHandler = ({ streamUid }: AppEvents['stream_end']): void => {
      const newMap = new Map(streamListenersRef.current);
      newMap.delete(streamUid);
      streamListenersRef.current = newMap;
    };

    const unsubscribeViewsTree = transport.on("update_views_tree", updateViewsTreeHandler);
    const unsubscribeUpdateView = transport.on("update_view", updateViewHandler);
    const unsubscribeDeleteView = transport.on("delete_view", deleteViewHandler);
    const unsubscribeStreamChunk = transport.on("stream_chunk", streamChunkHandler);
    const unsubscribeStreamEnd = transport.on("stream_end", streamEndHandler);

    if (requestViewTreeOnMount) {
      transport.emit("request_views_tree");
    }

    return () => {
      unsubscribeViewsTree?.();
      unsubscribeUpdateView?.();
      unsubscribeDeleteView?.();
      unsubscribeStreamChunk?.();
      unsubscribeStreamEnd?.();
      streamListenersRef.current = new Map();
    };
  }, [requestViewTreeOnMount]);

  return (
    <ViewsRenderer
      views={views as Readonly<Record<string, React.ComponentType<Record<string, unknown>>>>}
      viewsData={runningViews}
      createEvent={createEvent}
      streamSubscribe={streamSubscribe}
    />
  );
}

export default Client;
