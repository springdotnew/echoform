import React, { useEffect, useRef, useMemo, useCallback, useState, createContext, useContext, type ReactNode } from "react";
import { DockviewReact, type DockviewReadyEvent, type IDockviewPanelProps, type DockviewApi } from "dockview-react";
import "dockview-react/dist/styles/dockview.css";
import { Eye, EyeOff, FolderOpen } from "lucide-react";
import { Chip } from "@heroui/react";
import { STATUS_COLORS } from "../styles/theme";
import { HeaderActions } from "./HeaderActions";
import { reapplyLayout, saveLayout, loadSavedLayout, type LayoutPreset, type LayoutConfig } from "./layout";

// ── Types ──

interface ProcessInfo {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly category: string;
}

interface CategoryInfo {
  readonly name: string;
  readonly color: string;
  readonly processCount: number;
}

// ── Contexts ──

type TerminalRegistry = ReadonlyMap<string, ReactNode>;
const TerminalRegistryContext = createContext<TerminalRegistry>(new Map());

export interface ProcessActions {
  readonly activeStatus: string;
  readonly start: () => void;
  readonly stop: () => void;
  readonly restart: () => void;
}
export const ProcessActionsContext = createContext<ProcessActions | null>(null);

export interface LayoutActions {
  readonly currentPreset: LayoutPreset | null;
  readonly applyPreset: (preset: LayoutPreset) => void;
}
export const LayoutActionsContext = createContext<LayoutActions | null>(null);

// ── Keyboard shortcuts ──

function handleProcessShortcut(
  event: KeyboardEvent,
  processes: ReadonlyArray<ProcessInfo>,
  selectProcess: (id: string) => void,
): void {
  if (!(event.metaKey || event.ctrlKey)) return;
  if (event.key < "1" || event.key > "9") return;
  const shortcutIndex = parseInt(event.key, 10) - 1;
  if (shortcutIndex >= processes.length) return;
  event.preventDefault();
  const proc = processes[shortcutIndex];
  if (proc) selectProcess(proc.id);
}

// ── Dockview panel ──

function DockviewProcessPanel({ params }: IDockviewPanelProps<{ procId: string }>): React.ReactElement {
  const registry = useContext(TerminalRegistryContext);
  const child = registry.get(params.procId);
  if (!child) return <div className="p-5 text-muted-foreground">Loading...</div>;
  return <>{child}</>;
}

const panelComponents = { process: DockviewProcessPanel };

// ── Empty state ──

function EmptyState({
  categories,
  onOpen,
}: {
  readonly categories: ReadonlyArray<CategoryInfo>;
  readonly onOpen: (categoryName: string) => void;
}): React.ReactElement {
  return (
    <div className="flex items-center justify-center h-full w-full">
      <div className="flex flex-col items-center gap-6 max-w-md">
        <div className="text-muted-foreground text-sm uppercase tracking-wider font-semibold">
          Categories
        </div>
        <div className="flex flex-col gap-2 w-full">
          {categories.map((cat) => (
            <button
              key={cat.name}
              onClick={() => onOpen(cat.name)}
              className="flex items-center gap-3 px-4 py-3 rounded-lg bg-card hover:bg-secondary transition-colors border border-border text-left cursor-pointer group"
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: cat.color }}
              />
              <span className="flex-1 text-foreground font-medium">
                {cat.name}
              </span>
              <Chip size="sm" variant="soft">
                {cat.processCount}
              </Chip>
              <FolderOpen size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
        <p className="text-muted-foreground text-xs text-center mt-2">
          Click a category to show its terminals
        </p>
      </div>
    </div>
  );
}

// ── Sidebar ──

function Sidebar({
  categories,
  processes,
  visibleCategories,
  activeProcessId,
  onToggleCategory,
  onSelectProcess,
}: {
  readonly categories: ReadonlyArray<CategoryInfo>;
  readonly processes: ReadonlyArray<ProcessInfo>;
  readonly visibleCategories: ReadonlySet<string>;
  readonly activeProcessId: string;
  readonly onToggleCategory: (name: string) => void;
  readonly onSelectProcess: (id: string) => void;
}): React.ReactElement {
  return (
    <div className="w-48 min-w-48 bg-card border-r border-border flex flex-col select-none">
      <div className="px-3.5 pt-3 pb-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
        Processes
      </div>
      <div className="flex-1 overflow-y-auto">
        {categories.map((cat) => {
          const visible = visibleCategories.has(cat.name);
          const catProcesses = processes.filter((p) => p.category === cat.name);
          return (
            <div key={cat.name}>
              {/* Category header */}
              <button
                onClick={() => onToggleCategory(cat.name)}
                className="flex items-center gap-2 w-full px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider cursor-pointer hover:bg-secondary/50 transition-colors border-none bg-transparent"
                style={{ color: cat.color }}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: cat.color }}
                />
                <span className="flex-1 text-left">{cat.name}</span>
                {visible
                  ? <Eye size={12} className="text-muted-foreground" />
                  : <EyeOff size={12} className="text-muted-foreground opacity-40" />
                }
              </button>
              {/* Process items — only shown when category is visible */}
              {visible && catProcesses.map((proc) => {
                const active = proc.id === activeProcessId;
                const globalIndex = processes.indexOf(proc);
                return (
                  <button
                    key={proc.id}
                    onClick={() => onSelectProcess(proc.id)}
                    className={`flex items-center gap-2 w-full px-3.5 py-1.5 border-none text-[13px] text-left cursor-pointer transition-colors ${
                      active
                        ? "bg-secondary text-foreground border-l-2"
                        : "bg-transparent text-muted-foreground border-l-2 border-l-transparent hover:bg-secondary/30"
                    }`}
                    style={active ? { borderLeftColor: cat.color } : undefined}
                  >
                    <span
                      className="w-[7px] h-[7px] rounded-full shrink-0"
                      style={{ background: STATUS_COLORS[proc.status] ?? "#3f3f46" }}
                    />
                    <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                      {proc.name}
                    </span>
                    {globalIndex < 9 && (
                      <span className="text-[10px] text-ring tabular-nums">
                        ⌘{globalIndex + 1}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
      {/* Attribution */}
      <div className="px-3.5 py-2 text-[10px] text-muted-foreground/50 border-t border-border">
        Theme:{" "}
        <a
          href="https://github.com/better-auth/better-hub/blob/main/apps/web/src/app/globals.css"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-muted-foreground transition-colors"
        >
          better-hub
        </a>
      </div>
    </div>
  );
}

// ── Main component ──

export function WmuxApp(props: {
  readonly processes: ReadonlyArray<ProcessInfo>;
  readonly categories: ReadonlyArray<CategoryInfo>;
  readonly activeProcessId: string;
  readonly layout?: LayoutConfig | null;
  readonly children?: ReactNode;
  readonly onSelectProcess: { readonly mutate: (id: string) => void };
  readonly onStartProcess: { readonly mutate: (id: string) => void };
  readonly onStopProcess: { readonly mutate: (id: string) => void };
  readonly onRestartProcess: { readonly mutate: (id: string) => void };
}): React.ReactElement {
  const { processes, categories, activeProcessId, layout, children } = props;
  const selectProcess = props.onSelectProcess.mutate;
  const startProcess = props.onStartProcess.mutate;
  const stopProcess = props.onStopProcess.mutate;
  const restartProcess = props.onRestartProcess.mutate;

  const apiRef = useRef<DockviewApi | null>(null);
  const syncedRef = useRef<Set<string>>(new Set());
  const [visibleCategories, setVisibleCategories] = useState<Set<string>>(new Set());
  const [currentPreset, setCurrentPreset] = useState<LayoutPreset | null>(
    (layout as LayoutConfig | undefined | null)?.preset ?? null,
  );

  const registry = useMemo(() => {
    const map = new Map<string, ReactNode>();
    for (const child of React.Children.toArray(children) as React.ReactElement[]) {
      const id = (child.props as { id?: string }).id;
      if (id) map.set(id, child);
    }
    return map;
  }, [children]);

  // Processes visible based on visible categories
  const visibleProcesses = useMemo(
    () => processes.filter((p) => visibleCategories.has(p.category)),
    [processes, visibleCategories],
  );

  const hasVisibleProcesses = visibleProcesses.length > 0;

  // Toggle category visibility — add/remove panels in dockview
  const toggleCategory = useCallback((categoryName: string) => {
    setVisibleCategories((prev) => {
      const next = new Set(prev);
      const api = apiRef.current;

      if (next.has(categoryName)) {
        // Hide: remove panels for this category
        next.delete(categoryName);
        if (api) {
          for (const proc of processes) {
            if (proc.category === categoryName) {
              const panel = api.getPanel(proc.id);
              if (panel) api.removePanel(panel);
              syncedRef.current.delete(proc.id);
            }
          }
        }
      } else {
        // Show: add panels for this category
        next.add(categoryName);
        if (api) {
          for (const proc of processes) {
            if (proc.category === categoryName && !syncedRef.current.has(proc.id)) {
              api.addPanel({ id: proc.id, title: proc.name, component: "process", params: { procId: proc.id } });
              syncedRef.current.add(proc.id);
            }
          }
        }
      }
      return next;
    });
  }, [processes]);

  // Open a category from empty state
  const openCategory = useCallback((categoryName: string) => {
    if (!visibleCategories.has(categoryName)) {
      toggleCategory(categoryName);
    }
  }, [visibleCategories, toggleCategory]);

  // Sync new panels added after initial mount
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;

    for (const proc of processes) {
      if (visibleCategories.has(proc.category) && !syncedRef.current.has(proc.id)) {
        api.addPanel({ id: proc.id, title: proc.name, component: "process", params: { procId: proc.id } });
        syncedRef.current.add(proc.id);
      }
    }

    const activePanel = api.getPanel(activeProcessId);
    if (activePanel && api.activePanel?.id !== activeProcessId) {
      activePanel.api.setActive();
    }
  }, [processes, activeProcessId, visibleCategories]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => handleProcessShortcut(event, processes, selectProcess);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectProcess, processes]);

  const onReady = useCallback((event: DockviewReadyEvent) => {
    apiRef.current = event.api;
    event.api.onDidActivePanelChange((e) => { if (e?.id) selectProcess(e.id); });

    const processIds = processes.map((p) => p.id);

    // Try to restore saved layout first
    const restored = loadSavedLayout(event.api, processIds);
    if (restored) {
      for (const proc of processes) syncedRef.current.add(proc.id);
      // Mark categories of restored panels as visible
      const restoredCategories = new Set<string>();
      for (const panel of event.api.panels) {
        const proc = processes.find((p) => p.id === panel.id);
        if (proc) restoredCategories.add(proc.category);
      }
      setVisibleCategories(restoredCategories);
      return;
    }

    // Don't add any panels initially — user chooses categories
    event.api.onDidLayoutChange(() => {
      saveLayout(event.api, processIds);
    });
  }, []);

  const activeProc = processes.find((p) => p.id === activeProcessId);
  const activeStatus = activeProc?.status ?? "idle";

  const processActions = useMemo<ProcessActions>(() => ({
    activeStatus,
    start: () => startProcess(activeProcessId),
    stop: () => stopProcess(activeProcessId),
    restart: () => restartProcess(activeProcessId),
  }), [activeStatus, activeProcessId, startProcess, stopProcess, restartProcess]);

  const layoutActions = useMemo<LayoutActions>(() => ({
    currentPreset,
    applyPreset(preset: LayoutPreset) {
      const api = apiRef.current;
      if (!api) return;
      reapplyLayout(api, visibleProcesses, preset);
      setCurrentPreset(preset);
      for (const proc of visibleProcesses) syncedRef.current.add(proc.id);
      saveLayout(api, processes.map((p) => p.id));
    },
  }), [currentPreset, processes, visibleProcesses]);

  return (
    <div className="flex h-screen w-screen bg-background text-foreground font-sans">
      <Sidebar
        categories={categories}
        processes={processes}
        visibleCategories={visibleCategories}
        activeProcessId={activeProcessId}
        onToggleCategory={toggleCategory}
        onSelectProcess={selectProcess}
      />

      {/* Terminal area */}
      <div className="flex-1 relative">
        {hasVisibleProcesses ? (
          <ProcessActionsContext.Provider value={processActions}>
            <LayoutActionsContext.Provider value={layoutActions}>
              <TerminalRegistryContext.Provider value={registry}>
                <DockviewReact
                  className="dockview-theme-dark"
                  components={panelComponents}
                  onReady={onReady}
                  rightHeaderActionsComponent={HeaderActions}
                />
              </TerminalRegistryContext.Provider>
            </LayoutActionsContext.Provider>
          </ProcessActionsContext.Provider>
        ) : (
          <EmptyState categories={categories} onOpen={openCategory} />
        )}
      </div>
    </div>
  );
}
