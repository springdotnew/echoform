import React, { useContext, useRef, useState, useEffect, type ReactNode } from "react";
import { randomId } from "../shared";
import { AppContext } from "./contexts";

const ViewParentContext = React.createContext<
  { uid: string; childIndex: number } | undefined
>(undefined);

interface ViewComponentProps {
  name: string;
  props: Record<string, any> & { children?: ReactNode };
  children?: ReactNode;
}

function ViewComponent({ name, props, children }: ViewComponentProps) {
  const app = useContext(AppContext);
  const parent = useContext(ViewParentContext);
  const uidRef = useRef(randomId());
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
    parentUid: parent?.uid || "",
    isRoot: parent === undefined,
    childIndex: parent?.childIndex || 0,
    name: name,
    props: props,
    uid: uidRef.current,
  });

  const childrenFromProps = props.children;

  if (Array.isArray(childrenFromProps)) {
    return (
      <>
        {(childrenFromProps as ReactNode[]).map((child, index) => (
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
