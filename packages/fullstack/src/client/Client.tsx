import React, { useState, useEffect, useRef, useCallback } from "react";
import { ViewsToComponents } from "./types";
import {
  ExistingSharedViewData,
  ShareableViewData,
  Transport,
  Views,
  decompileTransport,
  randomId,
  ViewsRenderer,
} from "../shared";

const stringifyWithoutCircular = (json: any[]) => {
  if (
    json.some(
      (child) =>
        child instanceof Event ||
        (typeof child === "object" && "_reactName" in child)
    )
  ) {
    throw new Error(
      "passing js events to the server is prohibited, make sure you are not passing a callback's directly to a dom element"
    );
  }
  const getCircularReplacer = () => {
    const seen = new WeakSet();
    return (_key: string, value: any) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) {
          return;
        }
        seen.add(value);
      }
      return value;
    };
  };

  return JSON.stringify(json, getCircularReplacer());
};

interface ClientProps<ViewsInterface extends Views> {
  transport: Transport<Record<string, any>>;
  views: ViewsToComponents<ViewsInterface>;
  requestViewTreeOnMount?: boolean;
}

function Client<ViewsInterface extends Views>({
  transport: rawTransport,
  views,
  requestViewTreeOnMount,
}: ClientProps<ViewsInterface>) {
  const [runningViews, setRunningViews] = useState<ExistingSharedViewData[]>([]);
  const transportRef = useRef(decompileTransport(rawTransport));

  const createEvent = useCallback((eventUid: string, ...args: any) => {
    return new Promise((resolve) => {
      const requestUid = randomId();
      const transport = transportRef.current;

      let unsubscribe: (() => void) | undefined;

      const handler = ({
        data,
        uid,
        eventUid: responseEventUid,
      }: {
        data: any;
        uid: string;
        eventUid: string;
      }) => {
        if (uid === requestUid && responseEventUid === eventUid) {
          resolve(data);
          // Clean up listener after response received
          unsubscribe?.();
        }
      };

      unsubscribe = transport.on("respond_to_event", handler) || undefined;

      transport.emit("request_event", {
        eventArguments: JSON.parse(stringifyWithoutCircular(args)),
        eventUid: eventUid,
        uid: requestUid,
      });
    });
  }, []);

  useEffect(() => {
    const transport = transportRef.current;

    const updateViewsTreeHandler = ({ views }: { views: ExistingSharedViewData[] }) => {
      setRunningViews(views);
    };

    const updateViewHandler = ({ view }: { view: ShareableViewData }) => {
      setRunningViews((state) => {
        const runningView = state.find(
          (currentView) => currentView.uid === view.uid
        );
        if (runningView) {
          runningView.props = runningView.props.filter(
            (prop) => !view.props.delete.includes(prop.name)
          );
          view.props.create.forEach((newProp) => {
            runningView.props.push(newProp);
          });
        } else {
          state.push({ ...view, props: view.props.create });
        }
        return [...state];
      });
    };

    const deleteViewHandler = ({ viewUid }: { viewUid: string }) => {
      setRunningViews((state) => {
        const runningViewIndex = state.findIndex(
          (view) => view.uid === viewUid
        );
        if (runningViewIndex !== -1) {
          state.splice(runningViewIndex, 1);
          return [...state];
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

    // Cleanup listeners on unmount
    return () => {
      unsubscribeViewsTree?.();
      unsubscribeUpdateView?.();
      unsubscribeDeleteView?.();
    };
  }, [requestViewTreeOnMount]);

  return (
    <ViewsRenderer
      views={views}
      viewsData={runningViews}
      createEvent={createEvent}
    />
  );
}

export default Client;
