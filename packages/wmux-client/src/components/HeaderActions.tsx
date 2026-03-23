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
      className={`flex items-center justify-center w-6 h-6 rounded border border-transparent p-0 transition-colors ${
        disabled
          ? "text-ring/40 cursor-default opacity-40"
          : active
            ? "text-foreground/80 bg-secondary cursor-pointer"
            : "text-muted-foreground cursor-pointer hover:text-foreground hover:bg-secondary/50"
      }`}
      style={{ background: active && !disabled ? "var(--color-secondary)" : "none" }}
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
    <div className="flex items-center gap-0.5 px-2 ml-1 border-l border-border h-full">
      <IconButton icon={<Play size={12} />} title="Start" disabled={running} onClick={start} />
      <IconButton icon={<RotateCw size={11} />} title="Restart" disabled={!running} onClick={restart} />
      <IconButton icon={<Square size={10} />} title="Stop" disabled={!running} onClick={stop} />

      {layoutActions && (
        <>
          <div className="w-px h-3.5 bg-border mx-1" />
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
