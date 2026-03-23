import React, { useContext, useRef } from "react";
import type { ViewProps } from "../shared/types";
import { AppContext } from "./contexts";
import type { ViewDef, ViewDefs } from "../shared/view-builder";
import type { InferServerProps, StreamEmitter } from "../shared/view-inference";
import { createStreamEmitter } from "../shared/view-inference";
import { createStreamUid } from "../shared/branded.types";
import { randomId } from "../shared/id";
import type { StandardSchemaV1 } from "../shared/standard-schema";
import ViewComponent from "./ViewComponent";

// ---- Module-level ViewDef registry ----

const viewDefRegistry = new Map<string, ViewDef>();

export function getViewDef(name: string): ViewDef | undefined {
  return viewDefRegistry.get(name);
}

// ---- View component cache ----

const viewComponentCache = new Map<string, React.ComponentType<ViewProps>>();

function getOrCreateViewComponent(name: string): React.ComponentType<ViewProps> {
  const existingComponent = viewComponentCache.get(name);
  if (existingComponent) {
    return existingComponent;
  }

  const NewViewComponent = (props: ViewProps): React.ReactElement => (
    <ViewComponent name={name} props={props} />
  );
  NewViewComponent.displayName = `View(${name})`;

  viewComponentCache.set(name, NewViewComponent);
  return NewViewComponent;
}

const viewProxy = new Proxy({} as Record<string, React.ComponentType<ViewProps>>, {
  get: (_target, name): React.ComponentType<ViewProps> => {
    if (typeof name !== 'string') {
      throw new Error('trying to access a view with a non string name');
    }
    return getOrCreateViewComponent(name);
  }
});

// ---- Hooks ----

/**
 * Get typed view components for rendering on the server.
 *
 * ```ts
 * const View = useViews(views);
 * ```
 */
export function useViews<V extends ViewDefs>(_viewDefs?: V): ViewDefsToServerComponents<V> | null {
  const app = useContext(AppContext);

  if (_viewDefs) {
    for (const [name, def] of Object.entries(_viewDefs)) {
      viewDefRegistry.set(name, def);
    }
  }

  if (!app) {
    return null;
  }

  return viewProxy as unknown as ViewDefsToServerComponents<V>;
}

/**
 * Create a StreamEmitter for a server-to-client stream prop.
 *
 * ```ts
 * const output = useStream(TerminalDef, "output");
 * output.emit({ data: "hello" });
 * ```
 */
export function useStream<
  V extends ViewDef,
  K extends keyof V["streams"] & string,
>(
  _viewDef: V,
  _streamName: K,
): StreamEmitter<StandardSchemaV1.InferInput<V["streams"][K]["chunk"]>> {
  const app = useContext(AppContext);
  const emitterRef = useRef<ReturnType<typeof createStreamEmitter> | null>(null);

  if (!emitterRef.current) {
    const uid = createStreamUid(randomId());
    emitterRef.current = createStreamEmitter(
      uid,
      (streamUid, chunk) => app?.broadcastStreamChunk(streamUid, chunk),
      (streamUid) => app?.broadcastStreamEnd(streamUid),
    );
  }

  return emitterRef.current as StreamEmitter<StandardSchemaV1.InferInput<V["streams"][K]["chunk"]>>;
}

// ---- Type helpers ----

type ViewDefsToServerComponents<V extends ViewDefs> = {
  readonly [K in keyof V]: V[K] extends ViewDef
    ? React.FunctionComponent<InferServerProps<V[K]>>
    : never;
};
