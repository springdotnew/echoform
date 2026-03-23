import type { CompiledAppEvents, Prop as CompiledProp, ShareableViewData as CompiledShareableViewData } from "./compiledTypes";
import { EventContent, Events } from "./enum";
import type { AppEvents, Prop, Transport, SerializableValue, ExistingSharedViewData } from "./types";
import type { ViewUid } from "./branded.types";
import { createEventUid, createViewUid, createRequestUid, createPropName, createStreamUid } from "./branded.types";

// ---- Prop codecs ----

function propToCompiled(prop: Prop): CompiledProp {
  if (prop.type === "data") {
    return {
      [EventContent.Name]: prop.name,
      [EventContent.Type]: EventContent.Data,
      [EventContent.Data]: prop.data,
    };
  }
  if (prop.type === "stream") {
    return {
      [EventContent.Name]: prop.name,
      [EventContent.Type]: EventContent.Stream,
      [EventContent.StreamUid]: prop.uid,
    };
  }
  return {
    [EventContent.Name]: prop.name,
    [EventContent.Type]: EventContent.Event,
    [EventContent.Uid]: prop.uid,
  };
}

function compiledToProp(compiled: CompiledProp): Prop {
  const propType = compiled[EventContent.Type];
  const propName = compiled[EventContent.Name];

  if (propType === EventContent.Data) {
    const dataProp = compiled as { readonly [EventContent.Data]?: SerializableValue };
    return { name: createPropName(propName), type: "data", data: dataProp[EventContent.Data] };
  }
  if (propType === EventContent.Stream) {
    const streamProp = compiled as { readonly [EventContent.StreamUid]?: string };
    return { name: createPropName(propName), type: "stream", uid: createStreamUid(streamProp[EventContent.StreamUid] ?? '') };
  }
  const eventProp = compiled as { readonly [EventContent.Uid]?: string };
  return { name: createPropName(propName), type: "event", uid: createEventUid(eventProp[EventContent.Uid] ?? '') };
}

// ---- Event codec registry ----
// Each event defines compile (app → wire) and decompile (wire → app) in one place.

interface EventCodec<K extends keyof AppEvents> {
  readonly compiledEvent: Events;
  readonly compile: (data: AppEvents[K]) => unknown;
  readonly decompile: (data: unknown) => AppEvents[K];
}

function codec<K extends keyof AppEvents>(
  compiledEvent: Events,
  compile: (data: AppEvents[K]) => unknown,
  decompile: (data: unknown) => AppEvents[K],
): EventCodec<K> {
  return { compiledEvent, compile, decompile };
}

const codecs = {
  delete_view: codec<'delete_view'>(
    Events.DeleteView,
    (d) => d.viewUid,
    (d) => ({ viewUid: createViewUid(d as string) }),
  ),
  request_event: codec<'request_event'>(
    Events.RequestEvent,
    (d) => ({
      [EventContent.EventUid]: d.eventUid,
      [EventContent.EventArgs]: d.eventArguments,
      [EventContent.Uid]: d.uid,
    }),
    (d) => {
      const r = d as CompiledAppEvents[Events.RequestEvent];
      return {
        eventArguments: r[EventContent.EventArgs] ?? [],
        eventUid: createEventUid(r[EventContent.EventUid]),
        uid: createRequestUid(r[EventContent.Uid]),
      };
    },
  ),
  request_views_tree: codec<'request_views_tree'>(
    Events.RequestViewsTree,
    () => undefined,
    () => undefined as unknown as AppEvents['request_views_tree'],
  ),
  respond_to_event: codec<'respond_to_event'>(
    Events.RespondToEvent,
    (d) => ({
      [EventContent.Data]: d.data,
      [EventContent.EventUid]: d.eventUid,
      [EventContent.Uid]: d.uid,
    }),
    (d) => {
      const r = d as CompiledAppEvents[Events.RespondToEvent];
      return {
        data: r[EventContent.Data],
        eventUid: createEventUid(r[EventContent.EventUid]),
        uid: createRequestUid(r[EventContent.Uid]),
      };
    },
  ),
  update_view: codec<'update_view'>(
    Events.UpdateView,
    (d) => ({
      [EventContent.Uid]: d.view.uid,
      [EventContent.Name]: d.view.name,
      [EventContent.ParentUid]: d.view.parentUid,
      [EventContent.ChildIndex]: d.view.childIndex,
      [EventContent.isRoot]: d.view.isRoot,
      [EventContent.Props]: {
        [EventContent.Create]: d.view.props.create.length > 0 ? d.view.props.create.map(propToCompiled) : undefined,
        [EventContent.Delete]: d.view.props.delete.length > 0 ? d.view.props.delete : undefined,
      },
    }),
    (d) => {
      const v = d as CompiledShareableViewData;
      return {
        view: {
          uid: createViewUid(v[EventContent.Uid]),
          name: v[EventContent.Name],
          parentUid: createViewUid(v[EventContent.ParentUid]) as ViewUid | '',
          childIndex: v[EventContent.ChildIndex],
          isRoot: v[EventContent.isRoot],
          props: {
            create: (v[EventContent.Props][EventContent.Create] ?? []).map(compiledToProp),
            delete: (v[EventContent.Props][EventContent.Delete] ?? []).map(createPropName),
          },
        },
      };
    },
  ),
  update_views_tree: codec<'update_views_tree'>(
    Events.UpdateViewsTree,
    (d) => ({
      [EventContent.Views]: d.views.map((view) => ({
        [EventContent.Uid]: view.uid,
        [EventContent.Name]: view.name,
        [EventContent.ParentUid]: view.parentUid,
        [EventContent.ChildIndex]: view.childIndex,
        [EventContent.isRoot]: view.isRoot,
        [EventContent.Props]: view.props.map(propToCompiled),
      })),
    }),
    (d) => {
      const t = d as CompiledAppEvents[Events.UpdateViewsTree];
      return {
        views: (t[EventContent.Views] ?? []).map((view): ExistingSharedViewData => ({
          uid: createViewUid(view[EventContent.Uid]),
          name: view[EventContent.Name],
          parentUid: createViewUid(view[EventContent.ParentUid]) as ViewUid | '',
          childIndex: view[EventContent.ChildIndex],
          isRoot: view[EventContent.isRoot],
          props: (view[EventContent.Props] ?? []).map(compiledToProp),
        })),
      };
    },
  ),
  stream_chunk: codec<'stream_chunk'>(
    Events.StreamChunk,
    (d) => ({ [EventContent.StreamUid]: d.streamUid, [EventContent.Chunk]: d.chunk }),
    (d) => {
      const c = d as CompiledAppEvents[Events.StreamChunk];
      return { streamUid: createStreamUid(c[EventContent.StreamUid]), chunk: c[EventContent.Chunk] };
    },
  ),
  stream_end: codec<'stream_end'>(
    Events.StreamEnd,
    (d) => ({ [EventContent.StreamUid]: d.streamUid }),
    (d) => {
      const e = d as CompiledAppEvents[Events.StreamEnd];
      return { streamUid: createStreamUid(e[EventContent.StreamUid]) };
    },
  ),
} satisfies { readonly [K in keyof AppEvents]: EventCodec<K> };

// ---- DecompileTransport ----

export interface DecompileTransport {
  readonly on: <Key extends keyof AppEvents>(
    event: Key,
    handler: (data: AppEvents[Key]) => void
  ) => (() => void) | undefined;
  readonly emit: <Key extends keyof AppEvents>(
    event: Key,
    data?: AppEvents[Key]
  ) => void;
}

export function decompileTransport<TEvents extends Record<string | number, unknown>>(transport: Transport<TEvents>): DecompileTransport {
  const on = <Key extends keyof AppEvents>(
    event: Key,
    handler: (data: AppEvents[Key]) => void
  ): (() => void) | undefined => {
    const c = codecs[event] as EventCodec<Key>;

    const handlerExtended = (data: unknown): void => {
      handler(c.decompile(data));
    };

    (transport.on as (event: string, handler: (data: unknown) => void) => void)(String(c.compiledEvent), handlerExtended);
    return () => (transport.off as ((event: string, handler: (data: unknown) => void) => void) | undefined)?.(String(c.compiledEvent), handlerExtended);
  };

  const emitFn = <Key extends keyof AppEvents>(event: Key, data?: AppEvents[Key]): void => {
    const c = codecs[event] as EventCodec<Key>;
    const compiled = data !== undefined ? c.compile(data) : undefined;
    (transport.emit as (event: string, data: unknown) => void)(String(c.compiledEvent), compiled);
  };

  return { on, emit: emitFn };
}

// ---- Convenience emit helpers ----

type EmitFunctions = {
  readonly [Key in keyof AppEvents]: <TEvents extends Record<string | number, unknown>>(transport: Transport<TEvents>, data?: AppEvents[Key]) => void;
};

function emitFactory(): EmitFunctions {
  const result = {} as Record<keyof AppEvents, <TEvents extends Record<string | number, unknown>>(transport: Transport<TEvents>, data?: AppEvents[keyof AppEvents]) => void>;

  for (const event of Object.keys(codecs) as Array<keyof AppEvents>) {
    result[event] = <TEvents extends Record<string | number, unknown>>(transport: Transport<TEvents>, data?: AppEvents[typeof event]): void => {
      const decompiled = decompileTransport(transport);
      decompiled.emit(event, data);
    };
  }

  return result as EmitFunctions;
}

export const emit = emitFactory();
