import React, { useContext, type ReactNode } from "react";
import type { Views, ViewProps } from "../shared/types";
import { AppContext } from "./contexts";
import type { ViewsToServerComponents } from "./types";
import ViewComponent from "./ViewComponent";

type ViewComponentCache = Readonly<Record<string, React.ComponentType<ViewProps>>>;

const viewComponentCache: Record<string, React.ComponentType<ViewProps>> = {};

function getOrCreateViewComponent(name: string): React.ComponentType<ViewProps> {
  const existingComponent = viewComponentCache[name];
  if (existingComponent) {
    return existingComponent;
  }

  const NewViewComponent = (props: ViewProps): React.ReactElement => (
    <ViewComponent name={name} props={props} />
  );
  NewViewComponent.displayName = `View(${name})`;

  viewComponentCache[name] = NewViewComponent;
  return NewViewComponent;
}

export const viewProxy = new Proxy({} as ViewComponentCache, {
  get: (_target, name): React.ComponentType<ViewProps> => {
    if (typeof name !== 'string') {
      throw new Error('trying to access a view with a non string name');
    }
    return getOrCreateViewComponent(name);
  }
}) as ViewsToServerComponents<Views>;

export function ViewsProvider<ViewsInterface extends Views>(props: {
  readonly children: (views: ViewsToServerComponents<ViewsInterface>) => ReactNode;
}): React.ReactElement | null {
  const app = useContext(AppContext);

  if (!app) {
    return null;
  }

  return <>{props.children(viewProxy as ViewsToServerComponents<ViewsInterface>)}</>;
}
