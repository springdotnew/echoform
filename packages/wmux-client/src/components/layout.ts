// Layout utilities — kept minimal since each category owns its own tab group
import type { DockviewApi } from "dockview-react";

export function saveLayout(api: DockviewApi, key: string): void {
  try {
    localStorage.setItem(`wmux-layout-${key}`, JSON.stringify(api.toJSON()));
  } catch {
    // localStorage may be unavailable
  }
}

export function loadSavedLayout(api: DockviewApi, key: string): boolean {
  try {
    const raw = localStorage.getItem(`wmux-layout-${key}`);
    if (!raw) return false;
    api.fromJSON(JSON.parse(raw));
    return true;
  } catch {
    return false;
  }
}
