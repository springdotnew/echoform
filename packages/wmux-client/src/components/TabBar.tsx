import React from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { X, Play, RotateCw, Square } from "lucide-react";

// ── Types ──

export interface Tab {
  readonly id: string;
  readonly title: string;
  readonly closable?: boolean;
}

interface TabBarProps {
  readonly tabs: readonly Tab[];
  readonly activeId: string;
  readonly categoryColor: string;
  readonly onSelect: (id: string) => void;
  readonly onClose?: (id: string) => void;
  readonly onReorder?: (ids: string[]) => void;
  readonly processActions?: {
    readonly status: string;
    readonly onStart: () => void;
    readonly onStop: () => void;
    readonly onRestart: () => void;
  } | null;
}

// ── Sortable tab ──

function SortableTab({
  tab,
  index,
  active,
  onSelect,
  onClose,
}: {
  readonly tab: Tab;
  readonly index: number;
  readonly active: boolean;
  readonly onSelect: () => void;
  readonly onClose?: () => void;
}): React.ReactElement {
  const { ref, isDragging } = useSortable({ id: tab.id, index });

  return (
    <div
      ref={ref}
      onClick={onSelect}
      className={`flex items-center gap-1.5 px-3 h-8 text-[12px] cursor-pointer shrink-0 transition-colors duration-100 border-r border-border/10 ${
        active
          ? "bg-background text-foreground"
          : "text-muted-foreground/60 hover:text-muted-foreground"
      } ${isDragging ? "opacity-50" : ""}`}
    >
      <span className="truncate max-w-[120px]">{tab.title}</span>
      {tab.closable && onClose && (
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="flex items-center justify-center w-4 h-4 rounded-sm bg-transparent border-none text-muted-foreground/30 hover:text-foreground/60 hover:bg-muted/30 cursor-pointer transition-colors ml-0.5"
        >
          <X size={10} />
        </button>
      )}
    </div>
  );
}

// ── Process actions ──

function ProcessActions({ status, onStart, onStop, onRestart }: NonNullable<TabBarProps["processActions"]>): React.ReactElement {
  const running = status === "running";
  const btn = "flex items-center justify-center w-5 h-5 rounded border-none p-0 bg-transparent text-muted-foreground/50 hover:text-foreground disabled:opacity-20 disabled:cursor-default cursor-pointer transition-colors";

  return (
    <div className="flex items-center gap-px px-1.5 border-l border-border/20 h-full ml-auto shrink-0">
      <button disabled={running} onClick={onStart} title="Start" className={btn}><Play size={10} /></button>
      <button disabled={!running} onClick={onRestart} title="Restart" className={btn}><RotateCw size={9} /></button>
      <button disabled={!running} onClick={onStop} title="Stop" className={btn}><Square size={9} /></button>
    </div>
  );
}

// ── Tab bar ──

export function TabBar({ tabs, activeId, categoryColor, onSelect, onClose, onReorder, processActions }: TabBarProps): React.ReactElement {
  return (
    <div
      className="flex items-center h-8 border-b border-border/20 shrink-0 overflow-x-auto scrollbar-hide"
      style={{ backgroundColor: `color-mix(in srgb, ${categoryColor} 4%, var(--color-background))` }}
    >
      <DragDropProvider
        onDragEnd={(event) => {
          if (!onReorder || !event.operation.source || !event.operation.target) return;
          const oldId = String(event.operation.source.id);
          const newId = String(event.operation.target.id);
          if (oldId === newId) return;
          const ids = tabs.map((t) => t.id);
          const oldIdx = ids.indexOf(oldId);
          const newIdx = ids.indexOf(newId);
          if (oldIdx === -1 || newIdx === -1) return;
          const next = [...ids];
          next.splice(oldIdx, 1);
          next.splice(newIdx, 0, oldId);
          onReorder(next);
        }}
      >
        {tabs.map((tab, i) => (
          <SortableTab
            key={tab.id}
            tab={tab}
            index={i}
            active={tab.id === activeId}
            onSelect={() => onSelect(tab.id)}
            onClose={tab.closable && onClose ? () => onClose(tab.id) : undefined}
          />
        ))}
      </DragDropProvider>
      {processActions && <ProcessActions {...processActions} />}
    </div>
  );
}
