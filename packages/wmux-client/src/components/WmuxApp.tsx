import React, { useEffect, useRef, useMemo, useCallback, useState, createContext, useContext, type ReactNode } from "react";
import { DockviewReact, type DockviewReadyEvent, type IDockviewPanelProps, type DockviewApi } from "dockview-react";
import "dockview-react/dist/styles/dockview.css";
import { ChevronDown, ChevronRight, Play, Square, RotateCw } from "lucide-react";
import { STATUS_COLORS } from "../styles/theme";

// ── Types ──

interface TabInfo {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly status: string;
}

interface CategoryInfo {
  readonly name: string;
  readonly color: string;
  readonly tabs: readonly TabInfo[];
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

// ── Dockview panel ──

function DockviewProcessPanel({ params }: IDockviewPanelProps<{ procId: string }>): React.ReactElement {
  const registry = useContext(TerminalRegistryContext);
  const child = registry.get(params.procId);
  if (!child) return <div className="p-5 text-muted-foreground">Loading...</div>;
  return <>{child}</>;
}

const panelComponents = { process: DockviewProcessPanel };

// ── Header actions ──

function HeaderActions(): React.ReactElement {
  const actions = useContext(ProcessActionsContext);
  if (!actions) return <></>;
  const { activeStatus, start, stop, restart } = actions;
  const running = activeStatus === "running";
  const btn = "flex items-center justify-center w-5 h-5 rounded border-none p-0 bg-transparent text-muted-foreground hover:text-foreground disabled:opacity-25 disabled:cursor-default cursor-pointer transition-colors";

  return (
    <div className="flex items-center gap-px px-1.5 ml-0.5 border-l border-border h-full">
      <button disabled={running} onClick={start} title="Start" className={btn}><Play size={10} /></button>
      <button disabled={!running} onClick={restart} title="Restart" className={btn}><RotateCw size={9} /></button>
      <button disabled={!running} onClick={stop} title="Stop" className={btn}><Square size={9} /></button>
    </div>
  );
}

// ── Empty state ──

function EmptyState({
  categories,
  onOpen,
}: {
  readonly categories: ReadonlyArray<CategoryInfo>;
  readonly onOpen: (name: string) => void;
}): React.ReactElement {
  return (
    <div className="flex items-center justify-center h-full w-full">
      <div className="flex flex-col gap-1 w-60">
        {categories.map((cat) => (
          <button
            key={cat.name}
            onClick={() => onOpen(cat.name)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-md bg-transparent hover:bg-card transition-colors border border-transparent hover:border-border text-left cursor-pointer"
          >
            <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: cat.color }} />
            <span className="flex-1 text-foreground/90 text-[13px]">{cat.name}</span>
            <span className="text-muted-foreground/40 text-[11px] tabular-nums">{cat.tabs.length}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Sidebar ──

function Sidebar({
  categories,
  activeCategory,
  activeTabId,
  collapsedCategories,
  onSelectCategory,
  onToggleCollapse,
  onSelectTab,
}: {
  readonly categories: ReadonlyArray<CategoryInfo>;
  readonly activeCategory: string;
  readonly activeTabId: string;
  readonly collapsedCategories: ReadonlySet<string>;
  readonly onSelectCategory: (name: string) => void;
  readonly onToggleCollapse: (name: string) => void;
  readonly onSelectTab: (id: string) => void;
}): React.ReactElement {
  return (
    <div className="w-52 min-w-52 bg-background border-r border-border flex flex-col select-none overflow-y-auto">
      {categories.map((cat) => {
        const isActive = cat.name === activeCategory;
        const isCollapsed = collapsedCategories.has(cat.name);

        return (
          <div key={cat.name} className="mt-px">
            {/* Category header */}
            <div
              onClick={() => {
                onSelectCategory(cat.name);
                if (isCollapsed) onToggleCollapse(cat.name);
              }}
              className={`flex items-center gap-1 px-2 py-[5px] text-[11px] cursor-pointer transition-colors ${
                isActive ? "text-foreground/70" : "text-muted-foreground/60 hover:text-muted-foreground"
              }`}
            >
              <span
                onClick={(e) => { e.stopPropagation(); onToggleCollapse(cat.name); }}
                className="flex items-center justify-center w-3.5 h-3.5 cursor-pointer shrink-0"
              >
                {isCollapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
              </span>
              <span className="lowercase tracking-wide font-medium flex-1">{cat.name}</span>
              <span className="text-[10px] text-muted-foreground/30 tabular-nums pr-1">
                ({cat.tabs.length})
              </span>
            </div>

            {/* Tab items — two-line like the reference images */}
            {!isCollapsed && cat.tabs.map((tab) => {
              const isActiveTab = tab.id === activeTabId && isActive;
              return (
                <div
                  key={tab.id}
                  onClick={() => {
                    if (!isActive) onSelectCategory(cat.name);
                    onSelectTab(tab.id);
                  }}
                  className={`flex items-start gap-2 pl-6 pr-2 py-[3px] cursor-pointer transition-colors ${
                    isActiveTab
                      ? "bg-card text-foreground"
                      : "text-muted-foreground hover:bg-card/50 hover:text-foreground/80"
                  }`}
                >
                  <span
                    className="w-[5px] h-[5px] rounded-full shrink-0 mt-[7px]"
                    style={{ background: STATUS_COLORS[tab.status] ?? "#3f3f46" }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] leading-tight truncate">{tab.name}</div>
                    {tab.description && (
                      <div className="text-[10px] leading-tight text-muted-foreground/40 truncate">{tab.description}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ──

export function WmuxApp(props: {
  readonly categories: ReadonlyArray<CategoryInfo>;
  readonly activeCategory: string;
  readonly activeTabId: string;
  readonly children?: ReactNode;
  readonly onSelectCategory: { readonly mutate: (name: string) => void };
  readonly onSelectTab: { readonly mutate: (id: string) => void };
  readonly onStartProcess: { readonly mutate: (id: string) => void };
  readonly onStopProcess: { readonly mutate: (id: string) => void };
  readonly onRestartProcess: { readonly mutate: (id: string) => void };
}): React.ReactElement {
  const { categories, activeCategory, activeTabId, children } = props;
  const selectCategory = props.onSelectCategory.mutate;
  const selectTab = props.onSelectTab.mutate;
  const startProcess = props.onStartProcess.mutate;
  const stopProcess = props.onStopProcess.mutate;
  const restartProcess = props.onRestartProcess.mutate;

  const apiRef = useRef<DockviewApi | null>(null);
  const mountedCategoryRef = useRef<string>("");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const registry = useMemo(() => {
    const map = new Map<string, ReactNode>();
    for (const child of React.Children.toArray(children) as React.ReactElement[]) {
      const id = (child.props as { id?: string }).id;
      if (id) map.set(id, child);
    }
    return map;
  }, [children]);

  const activeCategoryData = categories.find((c) => c.name === activeCategory);
  const activeTabs = activeCategoryData?.tabs ?? [];
  const hasActiveCategory = activeCategory !== "";

  useEffect(() => {
    const api = apiRef.current;
    if (!api || !activeCategoryData) return;
    if (mountedCategoryRef.current === activeCategory) return;

    for (const panel of [...api.panels]) api.removePanel(panel);
    for (const tab of activeTabs) {
      api.addPanel({ id: tab.id, title: tab.name, component: "process", params: { procId: tab.id } });
    }
    mountedCategoryRef.current = activeCategory;

    if (activeTabId) {
      const panel = api.getPanel(activeTabId);
      if (panel) panel.api.setActive();
    }
  }, [activeCategory, activeTabs, activeTabId, activeCategoryData]);

  useEffect(() => {
    const api = apiRef.current;
    if (!api || !activeTabId) return;
    const panel = api.getPanel(activeTabId);
    if (panel && api.activePanel?.id !== activeTabId) panel.api.setActive();
  }, [activeTabId]);

  const onReady = useCallback((event: DockviewReadyEvent) => {
    apiRef.current = event.api;
    event.api.onDidActivePanelChange((e) => { if (e?.id) selectTab(e.id); });
    if (activeCategoryData) {
      for (const tab of activeCategoryData.tabs) {
        event.api.addPanel({ id: tab.id, title: tab.name, component: "process", params: { procId: tab.id } });
      }
      mountedCategoryRef.current = activeCategory;
    }
  }, []);

  const toggleCollapse = useCallback((name: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }, []);

  const activeTab = activeTabs.find((t) => t.id === activeTabId);
  const processActions = useMemo<ProcessActions>(() => ({
    activeStatus: activeTab?.status ?? "idle",
    start: () => { if (activeTabId) startProcess(activeTabId); },
    stop: () => { if (activeTabId) stopProcess(activeTabId); },
    restart: () => { if (activeTabId) restartProcess(activeTabId); },
  }), [activeTab?.status, activeTabId, startProcess, stopProcess, restartProcess]);

  return (
    <div className="flex h-screen w-screen bg-background text-foreground font-sans">
      <Sidebar
        categories={categories}
        activeCategory={activeCategory}
        activeTabId={activeTabId}
        collapsedCategories={collapsedCategories}
        onSelectCategory={selectCategory}
        onToggleCollapse={toggleCollapse}
        onSelectTab={selectTab}
      />
      <div className="flex-1 relative">
        {hasActiveCategory && activeTabs.length > 0 ? (
          <ProcessActionsContext.Provider value={processActions}>
            <TerminalRegistryContext.Provider value={registry}>
              <DockviewReact
                className="dockview-theme-dark"
                components={panelComponents}
                onReady={onReady}
                rightHeaderActionsComponent={HeaderActions}
              />
            </TerminalRegistryContext.Provider>
          </ProcessActionsContext.Provider>
        ) : (
          <EmptyState categories={categories} onOpen={selectCategory} />
        )}
      </div>
    </div>
  );
}
