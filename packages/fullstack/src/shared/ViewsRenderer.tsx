import React, { type ReactElement } from "react";
import type { ExistingSharedViewData, SerializableValue } from "./types";
import type { EventUid } from "./branded.types";

export interface RenderProps<TViews extends Readonly<Record<string, React.ComponentType<Record<string, unknown>>>> = Readonly<Record<string, React.ComponentType<Record<string, unknown>>>>> {
  readonly viewsData: ReadonlyArray<ExistingSharedViewData>;
  readonly createEvent?: (eventUid: EventUid, ...args: ReadonlyArray<SerializableValue>) => Promise<SerializableValue>;
  readonly views: TViews;
}

export function ViewsRenderer(props: RenderProps): ReactElement {
  const { viewsData, views } = props;
  const createEvent = props.createEvent ?? (async (): Promise<SerializableValue> => undefined);

  const renderView = (view: ExistingSharedViewData): ReactElement => {
    const ComponentToRender = views[view.name];

    if (!ComponentToRender) {
      return <React.Fragment key={view.uid} />;
    }

    const builtProps: Record<string, unknown> = { key: view.uid };

    for (const prop of view.props) {
      if (prop.type === "data") {
        builtProps[prop.name] = prop.data;
      } else if (prop.type === "event") {
        const eventUid = prop.uid;
        builtProps[prop.name] = (...args: ReadonlyArray<SerializableValue>): Promise<SerializableValue> => {
          return createEvent(eventUid, ...args);
        };
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
