import type { LayoutConfig, LayoutPreset, PanelPosition } from "./types";

export interface ResolvedPanel {
  readonly id: string;
  readonly position?: {
    readonly referencePanel: string;
    readonly direction: "left" | "right" | "above" | "below" | "within";
  };
}

/**
 * Resolve a layout config + process IDs into an ordered list of panels
 * with dockview-compatible position instructions.
 */
export function resolveLayout(
  processIds: readonly string[],
  config?: LayoutConfig,
): readonly ResolvedPanel[] {
  if (!config) return resolvePreset(processIds, "tabs");

  // Per-panel positioning takes precedence
  if (config.panels) return resolvePanelPositions(processIds, config.panels);

  return resolvePreset(processIds, config.preset ?? "tabs");
}

function resolvePreset(
  processIds: readonly string[],
  preset: LayoutPreset,
): readonly ResolvedPanel[] {
  switch (preset) {
    case "tabs": return resolveTabs(processIds);
    case "split-horizontal": return resolveSplitH(processIds);
    case "split-vertical": return resolveSplitV(processIds);
    case "grid": return resolveGrid(processIds);
  }
}

function resolveTabs(ids: readonly string[]): readonly ResolvedPanel[] {
  return ids.map((id) => ({ id }));
}

function resolveSplitH(ids: readonly string[]): readonly ResolvedPanel[] {
  const [first, ...rest] = ids;
  if (!first) return [];
  return [
    { id: first },
    ...rest.map((id) => ({
      id,
      position: { referencePanel: first, direction: "right" as const },
    })),
  ];
}

function resolveSplitV(ids: readonly string[]): readonly ResolvedPanel[] {
  const [first, ...rest] = ids;
  if (!first) return [];
  return [
    { id: first },
    ...rest.map((id) => ({
      id,
      position: { referencePanel: first, direction: "below" as const },
    })),
  ];
}

function resolveGrid(ids: readonly string[]): readonly ResolvedPanel[] {
  if (ids.length === 0) return [];
  if (ids.length === 1) return [{ id: ids[0]! }];

  const panels: ResolvedPanel[] = [];
  const first = ids[0]!;
  panels.push({ id: first });

  if (ids.length >= 2) {
    panels.push({ id: ids[1]!, position: { referencePanel: first, direction: "right" } });
  }
  if (ids.length >= 3) {
    panels.push({ id: ids[2]!, position: { referencePanel: first, direction: "below" } });
  }
  if (ids.length >= 4) {
    panels.push({ id: ids[3]!, position: { referencePanel: ids[1]!, direction: "below" } });
  }
  // Extra panels go as tabs in the last group
  for (let i = 4; i < ids.length; i++) {
    panels.push({ id: ids[i]!, position: { referencePanel: ids[3]!, direction: "within" } });
  }

  return panels;
}

function resolvePanelPositions(
  processIds: readonly string[],
  panels: Record<string, PanelPosition>,
): readonly ResolvedPanel[] {
  return processIds.map((id) => {
    const pos = panels[id];
    if (!pos?.referencePanel || !pos.direction) return { id };
    return {
      id,
      position: { referencePanel: pos.referencePanel, direction: pos.direction },
    };
  });
}
