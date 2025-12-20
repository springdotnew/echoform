import React, { type ReactElement } from "react";
import { ExistingSharedViewData } from "./types";

export interface RenderProps {
  viewsData: ExistingSharedViewData[];
  createEvent?: (eventUid: string, ...args: any) => any;
  views: Record<string, React.ComponentType<any>>;
}

export function ViewsRenderer(props: RenderProps) {
  const { viewsData, views } = props;
  const createEvent = props.createEvent || (() => {});
  const renderView = (view: ExistingSharedViewData): ReactElement => {
    const ComponentToRender = views[view.name];
    const props: any = { key: view.uid };
    view.props.forEach((prop) => {
      if (prop.type === "data") {
        props[prop.name] = prop.data;
      } else if (prop.type === "event") {
        props[prop.name] = (...args: any) => {
          return createEvent(prop.uid, ...args);
        };
      }
    });
    const children = viewsData
      .filter((runningView) => runningView.parentUid === view.uid)
      .sort((a, b) => a.childIndex - b.childIndex)
      .map((runningView) => renderView(runningView));
    return <ComponentToRender {...props}>{children}</ComponentToRender>;
  };
  const roots = viewsData.filter((view) => view.isRoot);
  if (roots.length === 0) {
    return <></>;
  }
  return <>{roots.map(renderView)}</>;
}
