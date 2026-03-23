import type { CompiledAppEvents, Prop as CompiledProp, ShareableViewData as CompiledShareableViewData } from "./compiledTypes";
import { EventContent, Events } from "./enum";
import type { AppEvents, Prop, Transport, SerializableValue, ExistingSharedViewData } from "./types";
import type { ViewUid, StreamUid } from "./branded.types";
import { createEventUid, createViewUid, createRequestUid, createPropName, createStreamUid } from "./branded.types";
import { nullIfEmpty } from "./collection.utils";

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
    return {
      name: createPropName(propName),
      type: "data",
      data: dataProp[EventContent.Data],
    };
  }
  if (propType === EventContent.Stream) {
    const streamProp = compiled as { readonly [EventContent.StreamUid]?: string };
    return {
      name: createPropName(propName),
      type: "stream",
      uid: createStreamUid(streamProp[EventContent.StreamUid] ?? ''),
    };
  }
  const eventProp = compiled as { readonly [EventContent.Uid]?: string };
  return {
    name: createPropName(propName),
    type: "event",
    uid: createEventUid(eventProp[EventContent.Uid] ?? ''),
  };
}

const map = {
  delete_view: Events.DeleteView,
  request_event: Events.RequestEvent,
  request_views_tree: Events.RequestViewsTree,
  respond_to_event: Events.RespondToEvent,
  update_view: Events.UpdateView,
  update_views_tree: Events.UpdateViewsTree,
  stream_chunk: Events.StreamChunk,
  stream_end: Events.StreamEnd,
} as const;

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
    const compiledEvent = map[event];

    const handlerExtended = (data: unknown): void => {
      let decompiled: AppEvents[keyof AppEvents];

      switch (compiledEvent) {
        case Events.DeleteView:
          decompiled = { viewUid: createViewUid(data as string) };
          break;
        case Events.RequestEvent: {
          const reqData = data as CompiledAppEvents[Events.RequestEvent];
          decompiled = {
            eventArguments: reqData[EventContent.EventArgs] ?? [],
            eventUid: createEventUid(reqData[EventContent.EventUid]),
            uid: createRequestUid(reqData[EventContent.Uid]),
          };
          break;
        }
        case Events.RequestViewsTree:
          decompiled = undefined as unknown as AppEvents['request_views_tree'];
          break;
        case Events.RespondToEvent: {
          const respData = data as CompiledAppEvents[Events.RespondToEvent];
          decompiled = {
            data: respData[EventContent.Data],
            eventUid: createEventUid(respData[EventContent.EventUid]),
            uid: createRequestUid(respData[EventContent.Uid]),
          };
          break;
        }
        case Events.UpdateView: {
          const viewData = data as CompiledShareableViewData;
          decompiled = {
            view: {
              uid: createViewUid(viewData[EventContent.Uid]),
              name: viewData[EventContent.Name],
              parentUid: createViewUid(viewData[EventContent.ParentUid]) as ViewUid | '',
              childIndex: viewData[EventContent.ChildIndex],
              isRoot: viewData[EventContent.isRoot],
              props: {
                create: (viewData[EventContent.Props][EventContent.Create] ?? []).map(compiledToProp),
                delete: (viewData[EventContent.Props][EventContent.Delete] ?? []).map(createPropName),
              },
            },
          };
          break;
        }
        case Events.UpdateViewsTree: {
          const treeData = data as CompiledAppEvents[Events.UpdateViewsTree];
          decompiled = {
            views: (treeData[EventContent.Views] ?? []).map((view): ExistingSharedViewData => ({
              uid: createViewUid(view[EventContent.Uid]),
              name: view[EventContent.Name],
              parentUid: createViewUid(view[EventContent.ParentUid]) as ViewUid | '',
              childIndex: view[EventContent.ChildIndex],
              isRoot: view[EventContent.isRoot],
              props: (view[EventContent.Props] ?? []).map(compiledToProp),
            })),
          };
          break;
        }
        case Events.StreamChunk: {
          const chunkData = data as CompiledAppEvents[Events.StreamChunk];
          decompiled = {
            streamUid: createStreamUid(chunkData[EventContent.StreamUid]),
            chunk: chunkData[EventContent.Chunk],
          };
          break;
        }
        case Events.StreamEnd: {
          const endData = data as CompiledAppEvents[Events.StreamEnd];
          decompiled = {
            streamUid: createStreamUid(endData[EventContent.StreamUid]),
          };
          break;
        }
        default:
          return;
      }

      handler(decompiled as AppEvents[Key]);
    };

    (transport.on as (event: string, handler: (data: unknown) => void) => void)(String(compiledEvent), handlerExtended);
    return () => (transport.off as ((event: string, handler: (data: unknown) => void) => void) | undefined)?.(String(compiledEvent), handlerExtended);
  };

  const emit = <Key extends keyof AppEvents>(event: Key, data?: AppEvents[Key]): void => {
    const compiledEvent = map[event];
    let compiled: unknown;

    switch (event) {
      case 'delete_view': {
        const deleteData = data as AppEvents['delete_view'];
        compiled = deleteData.viewUid;
        break;
      }
      case 'request_event': {
        const reqData = data as AppEvents['request_event'];
        compiled = {
          [EventContent.EventUid]: reqData.eventUid,
          [EventContent.EventArgs]: reqData.eventArguments,
          [EventContent.Uid]: reqData.uid,
        };
        break;
      }
      case 'request_views_tree':
        compiled = undefined;
        break;
      case 'respond_to_event': {
        const respData = data as AppEvents['respond_to_event'];
        compiled = {
          [EventContent.Data]: respData.data,
          [EventContent.EventUid]: respData.eventUid,
          [EventContent.Uid]: respData.uid,
        };
        break;
      }
      case 'update_view': {
        const viewData = data as AppEvents['update_view'];
        compiled = {
          [EventContent.Uid]: viewData.view.uid,
          [EventContent.Name]: viewData.view.name,
          [EventContent.ParentUid]: viewData.view.parentUid,
          [EventContent.ChildIndex]: viewData.view.childIndex,
          [EventContent.isRoot]: viewData.view.isRoot,
          [EventContent.Props]: {
            [EventContent.Create]: nullIfEmpty(viewData.view.props.create)?.map(propToCompiled),
            [EventContent.Delete]: nullIfEmpty(viewData.view.props.delete),
          },
        };
        break;
      }
      case 'update_views_tree': {
        const treeData = data as AppEvents['update_views_tree'];
        compiled = {
          [EventContent.Views]: treeData.views.map((view) => ({
            [EventContent.Uid]: view.uid,
            [EventContent.Name]: view.name,
            [EventContent.ParentUid]: view.parentUid,
            [EventContent.ChildIndex]: view.childIndex,
            [EventContent.isRoot]: view.isRoot,
            [EventContent.Props]: view.props.map(propToCompiled),
          })),
        };
        break;
      }
      case 'stream_chunk': {
        const chunkData = data as AppEvents['stream_chunk'];
        compiled = {
          [EventContent.StreamUid]: chunkData.streamUid,
          [EventContent.Chunk]: chunkData.chunk,
        };
        break;
      }
      case 'stream_end': {
        const endData = data as AppEvents['stream_end'];
        compiled = {
          [EventContent.StreamUid]: endData.streamUid,
        };
        break;
      }
    }

    (transport.emit as (event: string, data: unknown) => void)(String(compiledEvent), compiled);
  };

  return { on, emit };
}

type EmitFunctions = {
  readonly [Key in keyof AppEvents]: <TEvents extends Record<string | number, unknown>>(transport: Transport<TEvents>, data?: AppEvents[Key]) => void;
};

function emitFactory(): EmitFunctions {
  const result = {} as Record<keyof AppEvents, <TEvents extends Record<string | number, unknown>>(transport: Transport<TEvents>, data?: AppEvents[keyof AppEvents]) => void>;

  for (const event of Object.keys(map) as Array<keyof AppEvents>) {
    result[event] = <TEvents extends Record<string | number, unknown>>(transport: Transport<TEvents>, data?: AppEvents[typeof event]): void => {
      const decompiled = decompileTransport(transport);
      decompiled.emit(event, data);
    };
  }

  return result as EmitFunctions;
}

export const emit = emitFactory();
