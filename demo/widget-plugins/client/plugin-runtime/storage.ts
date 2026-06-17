import type { JsonObject } from "../../shared/plugin-types";

export interface StoredDashboardState {
  readonly widgetOrder: readonly string[];
  readonly selectedWidgetId: string | null;
  readonly widgetSources: Readonly<Record<string, string>>;
  readonly widgetStates: Readonly<Record<string, JsonObject>>;
}

const STORAGE_KEY = "echoform-widget-plugins:v3";

const fallbackState: StoredDashboardState = {
  widgetOrder: [],
  selectedWidgetId: null,
  widgetSources: {},
  widgetStates: {},
};

export function loadStoredState(): StoredDashboardState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallbackState;
    const parsed = JSON.parse(raw) as Partial<StoredDashboardState>;
    return {
      widgetOrder: Array.isArray(parsed.widgetOrder) ? parsed.widgetOrder.filter((id): id is string => typeof id === "string") : [],
      selectedWidgetId: typeof parsed.selectedWidgetId === "string" ? parsed.selectedWidgetId : null,
      widgetSources: parsed.widgetSources && typeof parsed.widgetSources === "object" ? parsed.widgetSources : {},
      widgetStates: parsed.widgetStates && typeof parsed.widgetStates === "object" ? parsed.widgetStates : {},
    };
  } catch {
    return fallbackState;
  }
}

export function saveStoredState(state: StoredDashboardState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
