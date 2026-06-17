import type { ExistingSharedViewData, SerializableValue } from "@playfast/echoform";
import type { JsonObject, PluginLog } from "../../shared/plugin-types";

export type WorkerPhase = "load" | "render" | "event";

export interface LoadPluginInput {
  readonly widgetId: string;
  readonly version: number;
  readonly code: string;
  readonly data: JsonObject;
  readonly initialState?: JsonObject;
}

export interface RenderInput {
  readonly widgetId: string;
}

export interface InvokeEventInput {
  readonly widgetId: string;
  readonly eventId: string;
  readonly args: readonly SerializableValue[];
}

export interface DisposePluginInput {
  readonly widgetId: string;
}

export type WorkerResult =
  | {
      readonly ok: true;
      readonly widgetId: string;
      readonly version: number;
      readonly views: readonly ExistingSharedViewData[];
      readonly state: JsonObject;
    }
  | {
      readonly ok: false;
      readonly widgetId: string;
      readonly phase: WorkerPhase;
      readonly error: string;
    };

export interface PluginStatus {
  readonly widgetId: string;
  readonly status: "idle" | "loading" | "running" | "error";
}

export interface WorkerRpc {
  readonly loadPlugin: (input: LoadPluginInput) => Promise<WorkerResult>;
  readonly render: (input: RenderInput) => Promise<WorkerResult>;
  readonly invokeEvent: (input: InvokeEventInput) => Promise<WorkerResult>;
  readonly disposePlugin: (input: DisposePluginInput) => Promise<void>;
}

export interface MainRpc {
  readonly log: (input: PluginLog) => void;
  readonly status: (input: PluginStatus) => void;
}
