import type { EventUid, RequestUid, ViewUid, PropName, StreamUid } from "./branded.types";

export type SerializableValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ReadonlyArray<SerializableValue>
  | { readonly [key: string]: SerializableValue };

export interface Transport<Events extends object> {
  readonly emit: <T extends keyof Events>(event: T, message?: Events[T]) => void;
  readonly on: <T extends keyof Events>(
    event: T,
    handler: (data: Events[T]) => void
  ) => void;
  readonly off?: (<T extends keyof Events>(
    event: T,
    handler: (data: Events[T]) => void
  ) => void) | undefined;
}

export interface EventResponseData {
  readonly data: SerializableValue;
  readonly uid: RequestUid;
  readonly eventUid: EventUid;
  readonly error?: string;
}

export interface EventRequestData {
  readonly eventArguments: ReadonlyArray<SerializableValue>;
  readonly uid: RequestUid;
  readonly eventUid: EventUid;
}

export interface AppEvents {
  readonly update_views_tree: {
    readonly views: ReadonlyArray<ExistingSharedViewData>;
  };
  readonly update_view: {
    readonly view: ShareableViewData;
  };
  readonly delete_view: {
    readonly viewUid: ViewUid;
  };
  readonly request_views_tree: void;
  readonly respond_to_event: EventResponseData;
  readonly request_event: EventRequestData;
  readonly stream_chunk: {
    readonly streamUid: StreamUid;
    readonly chunk: SerializableValue;
  };
  readonly stream_end: {
    readonly streamUid: StreamUid;
  };
  readonly stream_replay: {
    readonly streamUid: StreamUid;
    readonly chunks: ReadonlyArray<SerializableValue>;
  };
}

export interface ViewDataBase {
  readonly uid: ViewUid;
  readonly name: string;
  readonly parentUid: ViewUid | '';
  readonly childIndex: number;
  readonly isRoot: boolean;
}

export type ViewProps = Readonly<Record<string, unknown>>;

export type SerializableViewProps = Readonly<Record<string, SerializableValue | ((...args: ReadonlyArray<SerializableValue>) => unknown)>>;

export interface ViewData extends ViewDataBase {
  readonly props: SerializableViewProps;
}

export interface DataProp {
  readonly name: PropName;
  readonly type: 'data';
  readonly data: SerializableValue;
}

export interface EventProp {
  readonly name: PropName;
  readonly type: 'event';
  readonly uid: EventUid;
}

export interface StreamProp {
  readonly name: PropName;
  readonly type: 'stream';
  readonly uid: StreamUid;
}

export type Prop = DataProp | EventProp | StreamProp;

export interface ShareableViewData extends ViewDataBase {
  readonly props: {
    readonly create: ReadonlyArray<Prop>;
    readonly delete: ReadonlyArray<PropName>;
  };
}

export interface ExistingSharedViewData extends ViewDataBase {
  readonly props: ReadonlyArray<Prop>;
}

export type AppTransport = Transport<AppEvents>;
export type AnyTransport = Transport<Record<string | number, unknown>>;
