import { EventContent, Events } from "./enum";
import type { SerializableValue } from "./types";

/**
 * Compiled transport interface for compressed protocol.
 */
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

/**
 * Compiled app events using enum values for smaller payloads.
 */
export interface CompiledAppEvents {
  readonly [Events.UpdateViewsTree]: {
    readonly [EventContent.Views]: ReadonlyArray<ExistingSharedViewData>;
  };
  readonly [Events.UpdateView]: ShareableViewData;
  readonly [Events.DeleteView]: string;
  readonly [Events.RequestViewsTree]: void;
  readonly [Events.RespondToEvent]: {
    readonly [EventContent.Data]: SerializableValue;
    readonly [EventContent.Uid]: string;
    readonly [EventContent.EventUid]: string;
  };
  readonly [Events.RequestEvent]: {
    readonly [EventContent.EventArgs]?: ReadonlyArray<SerializableValue>;
    readonly [EventContent.Uid]: string;
    readonly [EventContent.EventUid]: string;
  };
}

/**
 * Base view data with compiled property keys.
 */
export interface ViewDataBase {
  readonly [EventContent.Uid]: string;
  readonly [EventContent.Name]: string;
  readonly [EventContent.ParentUid]: string;
  readonly [EventContent.ChildIndex]: number;
  readonly [EventContent.isRoot]: boolean;
}

/**
 * Full view data with compiled keys.
 */
export interface ViewData extends ViewDataBase {
  readonly [EventContent.Props]: Readonly<Record<string, SerializableValue>>;
}

/**
 * Data prop with compiled keys.
 */
export interface DataProp {
  readonly [EventContent.Name]: string;
  readonly [EventContent.Type]: typeof EventContent.Data;
  readonly [EventContent.Data]: SerializableValue;
}

/**
 * Event prop with compiled keys.
 */
export interface EventProp {
  readonly [EventContent.Name]: string;
  readonly [EventContent.Type]: typeof EventContent.Event;
  readonly [EventContent.Uid]: string;
}

/**
 * Prop discriminated union with compiled keys.
 */
export type Prop = DataProp | EventProp;

/**
 * Shareable view data with compiled keys.
 */
export interface ShareableViewData extends ViewDataBase {
  readonly [EventContent.Props]: {
    readonly [EventContent.Create]?: ReadonlyArray<Prop>;
    readonly [EventContent.Merge]?: ReadonlyArray<Prop>;
    readonly [EventContent.Delete]?: ReadonlyArray<string>;
  };
}

/**
 * Existing shared view data with compiled keys.
 */
export interface ExistingSharedViewData extends ViewDataBase {
  readonly [EventContent.Props]: ReadonlyArray<Prop>;
}

/**
 * Compiled transport type for the app protocol.
 */
export type CompiledAppTransport = Transport<CompiledAppEvents>;
