import React, { useState, useEffect, useRef, useCallback } from "react";
import type { ViewsToComponents } from "./types";
import type {
  ExistingSharedViewData,
  Transport,
  Views,
  SerializableValue,
  Prop,
  AppEvents,
} from "../shared/types";
import type { EventUid } from "../shared/branded.types";
import { createRequestUid } from "../shared/branded.types";
import { decompileTransport } from "../shared/decompiled-transport";
import { randomId } from "../shared/id";
import { ViewsRenderer } from "../shared/ViewsRenderer";
import { stringifyWithoutCircular } from "../shared/serialization.utils";

interface ClientProps<ViewsInterface extends Views, TEvents extends Record<string | number, unknown> = Record<string, unknown>> {
  readonly transport: Transport<TEvents>;
  readonly views: ViewsToComponents<ViewsInterface>;
  readonly requestViewTreeOnMount?: boolean;
}

function Client<ViewsInterface extends Views, TEvents extends Record<string | number, unknown> = Record<string, unknown>>({
  transport: rawTransport,
  views,
  requestViewTreeOnMount,
}: ClientProps<ViewsInterface, TEvents>): React.ReactElement {
  const [runningViews, setRunningViews] = useState<ReadonlyArray<ExistingSharedViewData>>([]);
  const transportRef = useRef(decompileTransport(rawTransport));

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

      const serializedArgs = JSON.parse(stringifyWithoutCircular(args)) as ReadonlyArray<SerializableValue>;

      transport.emit("request_event", {
        eventArguments: serializedArgs,
        eventUid: eventUid,
        uid: requestUid,
      });
    });
  }, []);

  useEffect(() => {
    const transport = transportRef.current;

    const updateViewsTreeHandler = ({ views }: AppEvents['update_views_tree']): void => {
      setRunningViews(views);
    };

    const updateViewHandler = ({ view }: AppEvents['update_view']): void => {
      setRunningViews((state): ReadonlyArray<ExistingSharedViewData> => {
        const existingIndex = state.findIndex(
          (currentView) => currentView.uid === view.uid
        );

        if (existingIndex >= 0) {
          const existingView = state[existingIndex];
          if (!existingView) {
            return state;
          }

          // Collect names to remove: deleted props + props being replaced by create
          const deletedNames = new Set(view.props.delete);
          const createNames = new Set(view.props.create.map((prop) => prop.name));

          // Filter out deleted props and props being replaced
          const filteredProps = existingView.props.filter(
            (prop) => !deletedNames.has(prop.name) && !createNames.has(prop.name)
          );

          // Add new/updated props
          const updatedProps: ReadonlyArray<Prop> = [...filteredProps, ...view.props.create];

          const updatedView: ExistingSharedViewData = {
            ...existingView,
            props: updatedProps,
          };

          return [
            ...state.slice(0, existingIndex),
            updatedView,
            ...state.slice(existingIndex + 1),
          ];
        }

        // New view
        const newView: ExistingSharedViewData = {
          uid: view.uid,
          name: view.name,
          parentUid: view.parentUid,
          childIndex: view.childIndex,
          isRoot: view.isRoot,
          props: view.props.create,
        };
        return [...state, newView];
      });
    };

    const deleteViewHandler = ({ viewUid }: AppEvents['delete_view']): void => {
      setRunningViews((state): ReadonlyArray<ExistingSharedViewData> => {
        const runningViewIndex = state.findIndex(
          (view) => view.uid === viewUid
        );
        if (runningViewIndex !== -1) {
          return [
            ...state.slice(0, runningViewIndex),
            ...state.slice(runningViewIndex + 1),
          ];
        }
        return state;
      });
    };

    const unsubscribeViewsTree = transport.on("update_views_tree", updateViewsTreeHandler);
    const unsubscribeUpdateView = transport.on("update_view", updateViewHandler);
    const unsubscribeDeleteView = transport.on("delete_view", deleteViewHandler);

    if (requestViewTreeOnMount) {
      transport.emit("request_views_tree");
    }

    return () => {
      unsubscribeViewsTree?.();
      unsubscribeUpdateView?.();
      unsubscribeDeleteView?.();
    };
  }, [requestViewTreeOnMount]);

  return (
    <ViewsRenderer
      views={views as Readonly<Record<string, React.ComponentType<Record<string, unknown>>>>}
      viewsData={runningViews}
      createEvent={createEvent}
    />
  );
}

export default Client;
