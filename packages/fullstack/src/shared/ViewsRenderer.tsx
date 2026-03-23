import React, { type ReactElement } from "react";
import type { ExistingSharedViewData, SerializableValue } from "./types";
import type { EventUid, StreamUid } from "./branded.types";
import type { StreamReceiver } from "./view-inference";

export interface RenderProps<TViews extends Readonly<Record<string, React.ComponentType<Record<string, unknown>>>> = Readonly<Record<string, React.ComponentType<Record<string, unknown>>>>> {
  readonly viewsData: ReadonlyArray<ExistingSharedViewData>;
  readonly createEvent?: (eventUid: EventUid, ...args: ReadonlyArray<SerializableValue>) => Promise<SerializableValue>;
  readonly views: TViews;
  readonly streamSubscribe?: (streamUid: StreamUid, listener: (chunk: SerializableValue) => void) => () => void;
}

export function ViewsRenderer(props: RenderProps): ReactElement {
  const { viewsData, views, streamSubscribe } = props;
  const createEvent = props.createEvent ?? (async (): Promise<SerializableValue> => undefined);

  const renderView = (view: ExistingSharedViewData): ReactElement => {
    const ComponentToRender = views[view.name];

    if (!ComponentToRender) {
      return <React.Fragment key={view.uid} />;
    }

    const builtProps: Record<string, unknown> = { key: view.uid };

    for (const prop of view.props) {
      if (prop.type === "data") {
        builtProps[prop.name as string] = prop.data;
      } else if (prop.type === "event") {
        const eventUid = prop.uid;
        const callbackFn = (...args: ReadonlyArray<SerializableValue>): Promise<SerializableValue> => {
          return createEvent(eventUid, ...args);
        };

        // Attach queryOptions for TanStack Query compatibility
        Object.defineProperty(callbackFn, "queryOptions", {
          value: () => ({
            mutationFn: callbackFn,
            mutationKey: [view.name, prop.name] as const,
          }),
          enumerable: false,
          configurable: false,
        });

        builtProps[prop.name as string] = callbackFn;
      } else if (prop.type === "stream" && streamSubscribe) {
        const streamUid = prop.uid;
        const receiver: StreamReceiver<SerializableValue> = {
          subscribe: (listener) => streamSubscribe(streamUid, listener),
        };
        builtProps[prop.name as string] = receiver;
      }
    }

    const children = viewsData
      .filter((runningView) => runningView.parentUid === view.uid)
      .sort((a, b) => a.childIndex - b.childIndex)
      .map((runningView) => renderView(runningView));

    return <ComponentToRender {...builtProps}>{children}</ComponentToRender>;
  };

  const roots = viewsData.filter((view) => view.isRoot);

  if (roots.length === 0) {
    return <></>;
  }

  return <>{roots.map(renderView)}</>;
}
