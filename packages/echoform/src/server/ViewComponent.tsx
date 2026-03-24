import React, { useContext, useRef, useState, useEffect, type ReactNode } from "react";
import { randomId } from "../shared/id";
import type { ViewUid } from "../shared/branded.types";
import { createViewUid } from "../shared/branded.types";
import type { ViewProps, SerializableViewProps } from "../shared/types";
import { AppContext } from "./contexts";

interface ViewParentContextValue {
  readonly uid: ViewUid;
  readonly childIndex: number;
}

const ViewParentContext = React.createContext<ViewParentContextValue | undefined>(undefined);

interface ViewComponentProps {
  readonly name: string;
  readonly props: ViewProps & { readonly children?: ReactNode };
  readonly children?: ReactNode;
}

function ViewComponent({ name, props, children: _children }: ViewComponentProps): React.ReactElement {
  const app = useContext(AppContext);
  const parent = useContext(ViewParentContext);
  const uidRef = useRef<ViewUid>(createViewUid(randomId()));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (app) {
        app.deleteRunningView(uidRef.current);
      }
    };
  }, [app]);

  if (!app || !mounted) {
    return <> </>;
  }

  app.updateRunningView({
    parentUid: parent?.uid ?? ('' as ViewUid | ''),
    isRoot: parent === undefined,
    childIndex: parent?.childIndex ?? 0,
    name: name,
    props: props as SerializableViewProps,
    uid: uidRef.current,
  });

  const childrenFromProps = props.children;

  if (Array.isArray(childrenFromProps)) {
    return (
      <>
        {(childrenFromProps as ReadonlyArray<ReactNode>).map((child, index) => (
          <ViewParentContext.Provider
            key={index}
            value={{ uid: uidRef.current, childIndex: index }}
          >
            {child}
          </ViewParentContext.Provider>
        ))}
      </>
    );
  }

  return (
    <ViewParentContext.Provider value={{ uid: uidRef.current, childIndex: 0 }}>
      {childrenFromProps}
    </ViewParentContext.Provider>
  );
}

export default ViewComponent;
