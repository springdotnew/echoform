import type { ReactElement } from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { X, Play, RotateCw, Square } from "lucide-react";

export interface Tab {
  readonly id: string;
  readonly title: string;
  readonly closable?: boolean | undefined;
}

interface TabBarProps {
  readonly tabs: readonly Tab[];
  readonly activeId: string;
  readonly categoryColor: string;
  readonly onSelect: (id: string) => void;
  readonly onClose?: ((id: string) => void) | undefined;
  readonly onReorder?: ((ids: string[]) => void) | undefined;
  readonly processActions?: {
    readonly status: string;
    readonly onStart: () => void;
    readonly onStop: () => void;
    readonly onRestart: () => void;
  } | null | undefined;
}

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
  readonly onClose?: (() => void) | undefined;
}): ReactElement {
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

const ACTION_BUTTON_CLASS = "flex items-center justify-center w-5 h-5 rounded border-none p-0 bg-transparent text-muted-foreground/50 hover:text-foreground disabled:opacity-20 disabled:cursor-default cursor-pointer transition-colors";

function ProcessActions({ status, onStart, onStop, onRestart }: NonNullable<TabBarProps["processActions"]>): ReactElement {
  const isRunning = status === "running";

  return (
    <div className="flex items-center gap-px px-1.5 border-l border-border/20 h-full ml-auto shrink-0">
      <button disabled={isRunning} onClick={onStart} title="Start" className={ACTION_BUTTON_CLASS}><Play size={10} /></button>
      <button disabled={!isRunning} onClick={onRestart} title="Restart" className={ACTION_BUTTON_CLASS}><RotateCw size={9} /></button>
      <button disabled={!isRunning} onClick={onStop} title="Stop" className={ACTION_BUTTON_CLASS}><Square size={9} /></button>
    </div>
  );
}

function reorderIds(ids: readonly string[], sourceId: string, targetId: string): string[] {
  const sourceIndex = ids.indexOf(sourceId);
  const targetIndex = ids.indexOf(targetId);
  if (sourceIndex === -1 || targetIndex === -1) return [...ids];
  const withoutSource = [...ids.slice(0, sourceIndex), ...ids.slice(sourceIndex + 1)];
  return [...withoutSource.slice(0, targetIndex), sourceId, ...withoutSource.slice(targetIndex)];
}

function handleDragEnd(
  event: Parameters<NonNullable<Parameters<typeof DragDropProvider>[0]["onDragEnd"]>>[0],
  tabs: readonly Tab[],
  onReorder: ((ids: string[]) => void) | undefined,
): void {
  if (!onReorder || !event.operation.source || !event.operation.target) return;
  const sourceId = String(event.operation.source.id);
  const targetId = String(event.operation.target.id);
  if (sourceId === targetId) return;
  onReorder(reorderIds(tabs.map((t) => t.id), sourceId, targetId));
}

export function TabBar({ tabs, activeId, categoryColor, onSelect, onClose, onReorder, processActions }: TabBarProps): ReactElement {
  return (
    <div
      className="flex items-center h-8 border-b border-border/20 shrink-0 overflow-x-auto scrollbar-hide"
      style={{ backgroundColor: `color-mix(in srgb, ${categoryColor} 4%, var(--color-background))` }}
    >
      <DragDropProvider
        onDragEnd={(event) => handleDragEnd(event, tabs, onReorder)}
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
