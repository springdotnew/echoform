import React, { useContext, type ReactNode } from "react";
import { Play, Square, RotateCw, LayoutGrid, Columns2, Rows2, LayoutList } from "lucide-react";
import { ProcessActionsContext, LayoutActionsContext } from "./WmuxApp";
import type { LayoutPreset } from "./layout";

function IconButton({ icon, title, disabled, onClick, active }: {
  readonly icon: ReactNode;
  readonly title: string;
  readonly disabled?: boolean;
  readonly onClick: () => void;
  readonly active?: boolean;
}): React.ReactElement {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 24, height: 24,
        borderRadius: 4,
        border: "1px solid transparent",
        background: active ? "rgba(255,255,255,0.06)" : "none",
        color: disabled ? "#333" : active ? "#ccc" : "#999",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1,
        padding: 0,
      }}
    >
      {icon}
    </button>
  );
}

const LAYOUT_ICONS: Record<LayoutPreset, ReactNode> = {
  tabs: <LayoutList size={11} />,
  "split-horizontal": <Columns2 size={11} />,
  "split-vertical": <Rows2 size={11} />,
  grid: <LayoutGrid size={11} />,
};

const LAYOUT_LABELS: Record<LayoutPreset, string> = {
  tabs: "Tabs",
  "split-horizontal": "Split Horizontal",
  "split-vertical": "Split Vertical",
  grid: "Grid",
};

const PRESETS: readonly LayoutPreset[] = ["tabs", "split-horizontal", "split-vertical", "grid"];

export function HeaderActions(): React.ReactElement {
  const processActions = useContext(ProcessActionsContext);
  const layoutActions = useContext(LayoutActionsContext);

  if (!processActions) return <></>;

  const { activeStatus, start, stop, restart } = processActions;
  const running = activeStatus === "running";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "0 8px", marginLeft: 4, borderLeft: "1px solid #2a2a2a", height: "100%" }}>
      <IconButton icon={<Play size={12} />} title="Start" disabled={running} onClick={start} />
      <IconButton icon={<RotateCw size={11} />} title="Restart" disabled={!running} onClick={restart} />
      <IconButton icon={<Square size={10} />} title="Stop" disabled={!running} onClick={stop} />

      {layoutActions && (
        <>
          <div style={{ width: 1, height: 14, background: "#2a2a2a", margin: "0 4px" }} />
          {PRESETS.map((preset) => (
            <IconButton
              key={preset}
              icon={LAYOUT_ICONS[preset]}
              title={LAYOUT_LABELS[preset]}
              onClick={() => layoutActions.applyPreset(preset)}
              active={layoutActions.currentPreset === preset}
            />
          ))}
        </>
      )}
    </div>
  );
}
