import React, { type ReactElement } from "react";
import type { ExistingSharedViewData, SerializableValue } from "./types";
import type { EventUid, StreamUid } from "./branded.types";
import type { StreamReceiver } from "./view-inference";

export interface RenderProps {
  readonly viewsData: ReadonlyArray<ExistingSharedViewData>;
  readonly createEvent?: (eventUid: EventUid, ...args: ReadonlyArray<SerializableValue>) => Promise<SerializableValue>;
  readonly views: Readonly<Record<string, React.ComponentType<Record<string, unknown>>>>;
  readonly streamSubscribe?: (streamUid: StreamUid, listener: (chunk: SerializableValue) => void) => () => void;
}

function buildCallbackProp(
  eventUid: EventUid,
  createEvent: (eventUid: EventUid, ...args: ReadonlyArray<SerializableValue>) => Promise<SerializableValue>,
) {
  return {
    mutate: (...args: ReadonlyArray<SerializableValue>): Promise<SerializableValue> => {
      return createEvent(eventUid, ...args);
    },
  };
}

function buildStreamProp(
  streamUid: StreamUid,
  streamSubscribe: (streamUid: StreamUid, listener: (chunk: SerializableValue) => void) => () => void,
): StreamReceiver<SerializableValue> {
  return {
    subscribe: (listener) => streamSubscribe(streamUid, listener),
  };
}

export function ViewsRenderer(props: RenderProps): ReactElement {
  const { viewsData, views, streamSubscribe } = props;
  const createEvent = props.createEvent ?? (async (): Promise<SerializableValue> => undefined);

  const renderView = (view: ExistingSharedViewData): ReactElement => {
    const ComponentToRender = views[view.name];

    if (!ComponentToRender) {
      return <React.Fragment key={view.uid} />;
    }

    const builtProps: Record<string, unknown> = {};

    for (const prop of view.props) {
      if (prop.type === "data") {
        builtProps[prop.name as string] = prop.data;
      } else if (prop.type === "event") {
        builtProps[prop.name as string] = buildCallbackProp(prop.uid, createEvent);
      } else if (prop.type === "stream" && streamSubscribe) {
        builtProps[prop.name as string] = buildStreamProp(prop.uid, streamSubscribe);
      }
    }

    const children = viewsData
      .filter((runningView) => runningView.parentUid === view.uid)
      .sort((a, b) => a.childIndex - b.childIndex)
      .map((runningView) => renderView(runningView));

    return <ComponentToRender key={view.uid} {...builtProps}>{children}</ComponentToRender>;
  };

  const roots = viewsData.filter((view) => view.isRoot);

  if (roots.length === 0) {
    return <></>;
  }

  return <>{roots.map(renderView)}</>;
}
