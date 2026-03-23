import React, { useContext, useRef } from "react";
import type { Views, ViewProps } from "../shared/types";
import { AppContext } from "./contexts";
import type { ViewsToServerComponents } from "./types";
import type { ViewDef, ViewDefs } from "../shared/view-builder";
import type { InferServerProps, StreamEmitter } from "../shared/view-inference";
import { StreamEmitterImpl } from "../shared/view-inference";
import type { StreamUid } from "../shared/branded.types";
import { createStreamUid } from "../shared/branded.types";
import { randomId } from "../shared/id";
import type { StandardSchemaV1 } from "../shared/standard-schema";
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

const viewProxy = new Proxy({} as ViewComponentCache, {
  get: (_target, name): React.ComponentType<ViewProps> => {
    if (typeof name !== 'string') {
      throw new Error('trying to access a view with a non string name');
    }
    return getOrCreateViewComponent(name);
  }
});

/**
 * Get typed view components for rendering on the server.
 *
 * ```ts
 * // New API (with ViewDefs)
 * const View = useViews(views);
 *
 * // Legacy API (with type parameter)
 * const View = useViews<MyViews>();
 * ```
 */
export function useViews<V extends ViewDefs>(_viewDefs?: V): ViewDefsToServerComponents<V> | null {
  const app = useContext(AppContext);

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
  V extends ViewDef<string, Record<string, StandardSchemaV1>, Record<string, never>, Record<string, import("../shared/view-builder").StreamDef>>,
  K extends keyof V["streams"] & string,
>(
  _viewDef: V,
  _streamName: K,
): StreamEmitter<StandardSchemaV1.InferInput<V["streams"][K]["chunk"]>> {
  const app = useContext(AppContext);
  const emitterRef = useRef<StreamEmitterImpl | null>(null);

  if (!emitterRef.current) {
    const uid = createStreamUid(randomId());
    emitterRef.current = new StreamEmitterImpl(
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
