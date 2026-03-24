import { useCallback, useRef, useState, useEffect, type ReactElement } from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { X, Play, RotateCw, Square, ChevronLeft, ChevronRight } from "lucide-react";
import { resolveIcon } from "../utils/icons";

export interface Tab {
  readonly id: string;
  readonly title: string;
  readonly closable?: boolean | undefined;
  readonly icon?: string | undefined;
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
  categoryColor,
  onSelect,
  onClose,
}: {
  readonly tab: Tab;
  readonly index: number;
  readonly active: boolean;
  readonly categoryColor: string;
  readonly onSelect: () => void;
  readonly onClose?: (() => void) | undefined;
}): ReactElement {
  const { ref, isDragging } = useSortable({ id: tab.id, index });
  const TabIcon = resolveIcon(tab.icon);

  return (
    <div
      ref={ref}
      onClick={onSelect}
      className={`relative flex items-center gap-1.5 px-3 h-9 text-[12px] cursor-pointer shrink-0 transition-colors duration-100 border-r border-border/15 ${
        active
          ? "bg-background text-foreground"
          : "text-muted-foreground/70 hover:text-foreground/90 hover:bg-background/50"
      } ${isDragging ? "opacity-50" : ""}`}
    >
      {TabIcon && <TabIcon size={12} className={active ? "text-foreground/80" : "text-muted-foreground/60"} />}
      <span className="truncate max-w-[140px]">{tab.title}</span>
      {tab.closable && onClose && (
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="flex items-center justify-center w-4 h-4 rounded-sm bg-transparent border-none text-muted-foreground/50 hover:text-foreground/80 hover:bg-muted/40 cursor-pointer transition-colors ml-0.5"
        >
          <X size={10} />
        </button>
      )}
      {active && (
        <span className="absolute bottom-0 left-1 right-1 h-[2px] rounded-full" style={{ background: categoryColor }} />
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

function useOverflowDetection(ref: React.RefObject<HTMLDivElement | null>): { overflowLeft: boolean; overflowRight: boolean; scrollBy: (delta: number) => void } {
  const [overflowLeft, setOverflowLeft] = useState(false);
  const [overflowRight, setOverflowRight] = useState(false);

  const check = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setOverflowLeft(el.scrollLeft > 2);
    setOverflowRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, [ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    check();
    el.addEventListener("scroll", check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", check); ro.disconnect(); };
  }, [ref, check]);

  const scrollBy = useCallback((delta: number) => {
    ref.current?.scrollBy({ left: delta, behavior: "smooth" });
  }, [ref]);

  return { overflowLeft, overflowRight, scrollBy };
}

const SCROLL_ARROW_CLASS = "absolute top-0 bottom-0 w-8 flex items-center z-10 cursor-pointer transition-opacity text-muted-foreground/50 hover:text-muted-foreground/80";

export function TabBar({ tabs, activeId, categoryColor, onSelect, onClose, onReorder, processActions }: TabBarProps): ReactElement {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { overflowLeft, overflowRight, scrollBy } = useOverflowDetection(scrollRef);

  const onDragEnd = useCallback(
    (event: Parameters<NonNullable<Parameters<typeof DragDropProvider>[0]["onDragEnd"]>>[0]) => handleDragEnd(event, tabs, onReorder),
    [tabs, onReorder],
  );

  return (
    <div className="relative shrink-0 group/tabbar">
      <div
        ref={scrollRef}
        className="flex items-center h-9 border-b border-border/50 overflow-x-auto scrollbar-hide"
        style={{ backgroundColor: `color-mix(in srgb, ${categoryColor} 6%, var(--color-background))` }}
      >
        <DragDropProvider onDragEnd={onDragEnd}>
          {tabs.map((tab, i) => (
            <SortableTab
              key={tab.id}
              tab={tab}
              index={i}
              active={tab.id === activeId}
              categoryColor={categoryColor}
              onSelect={() => onSelect(tab.id)}
              onClose={tab.closable && onClose ? () => onClose(tab.id) : undefined}
            />
          ))}
        </DragDropProvider>
        {processActions && <ProcessActions {...processActions} />}
      </div>

      {overflowLeft && (
        <div className={`${SCROLL_ARROW_CLASS} left-0 justify-start pl-0.5 bg-gradient-to-r from-background/80 to-transparent`} onClick={() => scrollBy(-120)}>
          <ChevronLeft size={14} />
        </div>
      )}
      {overflowRight && (
        <div className={`${SCROLL_ARROW_CLASS} right-0 justify-end pr-0.5 bg-gradient-to-l from-background/80 to-transparent`} onClick={() => scrollBy(120)}>
          <ChevronRight size={14} />
        </div>
      )}
    </div>
  );
}
