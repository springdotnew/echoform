import type React from "react";
import type { EventUid, RequestUid, ViewUid, PropName } from "./branded.types";

export type SerializableValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ReadonlyArray<SerializableValue>
  | { readonly [key: string]: SerializableValue };

export type MutableSerializableValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | MutableSerializableValue[]
  | { [key: string]: MutableSerializableValue };

export interface Transport<Events extends object> {
  readonly emit: <T extends keyof Events>(event: T, message?: Events[T]) => void;
  readonly on: <T extends keyof Events>(
    event: T,
    handler: (data: Events[T]) => void
  ) => void;
  readonly off?: <T extends keyof Events>(
    event: T,
    handler: (data: Events[T]) => void
  ) => void;
}

export interface EventResponseData {
  readonly data: SerializableValue;
  readonly uid: RequestUid;
  readonly eventUid: EventUid;
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

export type Prop = DataProp | EventProp;

export interface ShareableViewData extends ViewDataBase {
  readonly props: {
    readonly create: ReadonlyArray<Prop>;
    readonly merge: ReadonlyArray<Prop>;
    readonly delete: ReadonlyArray<PropName>;
  };
}

export interface ExistingSharedViewData extends ViewDataBase {
  readonly props: ReadonlyArray<Prop>;
}

export interface MutableExistingSharedViewData {
  uid: ViewUid;
  name: string;
  parentUid: ViewUid | '';
  childIndex: number;
  isRoot: boolean;
  props: Prop[];
}

export type AppTransport = Transport<AppEvents>;

export interface View<Props> {
  readonly props: React.PropsWithChildren<Props>;
}

export interface Views {
  readonly [key: string]: View<ViewProps>;
}
