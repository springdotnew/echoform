import type { DockviewApi } from "dockview-react";

export type LayoutPreset = "tabs" | "split-horizontal" | "split-vertical" | "grid";

interface PanelPosition {
  readonly referencePanel?: string;
  readonly direction?: "left" | "right" | "above" | "below" | "within";
}

export interface LayoutConfig {
  readonly preset?: LayoutPreset;
  readonly panels?: Record<string, PanelPosition>;
}

interface ResolvedPanel {
  readonly id: string;
  readonly name: string;
  readonly position?: {
    readonly referencePanel: string;
    readonly direction: "left" | "right" | "above" | "below" | "within";
  };
}

function resolvePreset(
  processes: ReadonlyArray<{ readonly id: string; readonly name: string }>,
  preset: LayoutPreset,
): readonly ResolvedPanel[] {
  switch (preset) {
    case "tabs":
      return processes.map((p) => ({ id: p.id, name: p.name }));
    case "split-horizontal": {
      const [first, ...rest] = processes;
      if (!first) return [];
      return [
        { id: first.id, name: first.name },
        ...rest.map((p) => ({
          id: p.id, name: p.name,
          position: { referencePanel: first.id, direction: "right" as const },
        })),
      ];
    }
    case "split-vertical": {
      const [first, ...rest] = processes;
      if (!first) return [];
      return [
        { id: first.id, name: first.name },
        ...rest.map((p) => ({
          id: p.id, name: p.name,
          position: { referencePanel: first.id, direction: "below" as const },
        })),
      ];
    }
    case "grid": {
      if (processes.length === 0) return [];
      const panels: ResolvedPanel[] = [];
      const first = processes[0]!;
      panels.push({ id: first.id, name: first.name });
      if (processes.length >= 2) {
        panels.push({ id: processes[1]!.id, name: processes[1]!.name, position: { referencePanel: first.id, direction: "right" } });
      }
      if (processes.length >= 3) {
        panels.push({ id: processes[2]!.id, name: processes[2]!.name, position: { referencePanel: first.id, direction: "below" } });
      }
      if (processes.length >= 4) {
        panels.push({ id: processes[3]!.id, name: processes[3]!.name, position: { referencePanel: processes[1]!.id, direction: "below" } });
      }
      for (let i = 4; i < processes.length; i++) {
        panels.push({ id: processes[i]!.id, name: processes[i]!.name, position: { referencePanel: processes[3]!.id, direction: "within" } });
      }
      return panels;
    }
  }
}

function resolvePanelPositions(
  processes: ReadonlyArray<{ readonly id: string; readonly name: string }>,
  panels: Record<string, PanelPosition>,
): readonly ResolvedPanel[] {
  return processes.map((p) => {
    const pos = panels[p.id];
    if (!pos?.referencePanel || !pos.direction) return { id: p.id, name: p.name };
    return {
      id: p.id,
      name: p.name,
      position: { referencePanel: pos.referencePanel, direction: pos.direction },
    };
  });
}

export function applyLayout(
  api: DockviewApi,
  processes: ReadonlyArray<{ readonly id: string; readonly name: string }>,
  config?: LayoutConfig,
): void {
  const panels = config?.panels
    ? resolvePanelPositions(processes, config.panels)
    : resolvePreset(processes, config?.preset ?? "tabs");

  for (const panel of panels) {
    api.addPanel({
      id: panel.id,
      title: panel.name,
      component: "process",
      params: { procId: panel.id },
      position: panel.position ? {
        referencePanel: panel.position.referencePanel,
        direction: panel.position.direction,
      } : undefined,
    });
  }
}

export function reapplyLayout(
  api: DockviewApi,
  processes: ReadonlyArray<{ readonly id: string; readonly name: string }>,
  preset: LayoutPreset,
): void {
  // Remove all existing panels
  const existing = api.panels;
  for (const panel of existing) {
    api.removePanel(panel);
  }

  applyLayout(api, processes, { preset });
}

// ── Layout persistence ──

function getStorageKey(processIds: readonly string[]): string {
  const sorted = [...processIds].sort().join(",");
  let hash = 0;
  for (let i = 0; i < sorted.length; i++) {
    hash = ((hash << 5) - hash + sorted.charCodeAt(i)) | 0;
  }
  return `wmux-layout-${hash}`;
}

export function saveLayout(api: DockviewApi, processIds: readonly string[]): void {
  try {
    const serialized = api.toJSON();
    localStorage.setItem(getStorageKey(processIds), JSON.stringify(serialized));
  } catch {
    // localStorage may be unavailable
  }
}

export function loadSavedLayout(api: DockviewApi, processIds: readonly string[]): boolean {
  try {
    const raw = localStorage.getItem(getStorageKey(processIds));
    if (!raw) return false;
    const serialized = JSON.parse(raw);
    api.fromJSON(serialized);
    return true;
  } catch {
    return false;
  }
}
