import type { ExistingSharedViewData, SerializableValue } from "@playfast/echoform";

export type JsonObject = Readonly<Record<string, SerializableValue>>;

export type WidgetKind = "metric" | "chart" | "table" | "action" | "custom";
export type WidgetLayout = "compact" | "standard" | "wide" | "tall" | "hero";

export type WidgetStatus = "idle" | "bundling" | "running" | "error";

export interface WidgetDescriptor {
  readonly id: string;
  readonly title: string;
  readonly kind: WidgetKind;
  readonly layout?: WidgetLayout;
  readonly data: JsonObject;
}

export interface BundleRequest {
  readonly widgetId: string;
  readonly source: string;
}

export type BundleResult =
  | {
      readonly ok: true;
      readonly code: string;
      readonly warnings: readonly string[];
    }
  | {
      readonly ok: false;
      readonly error: string;
      readonly warnings: readonly string[];
    };

export interface ReorderRequest {
  readonly activeId: string;
  readonly overId: string;
}

export interface SourceChangeRequest {
  readonly widgetId: string;
  readonly source: string;
}

export interface PluginLog {
  readonly widgetId: string;
  readonly level: "log" | "warn" | "error";
  readonly message: string;
}

export interface RenderedWidget {
  readonly views: readonly ExistingSharedViewData[];
  readonly state: JsonObject;
}
