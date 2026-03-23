import React, { useEffect, useRef, useMemo, useCallback, useState, createContext, useContext, type ReactNode } from "react";
import { DockviewReact, type DockviewReadyEvent, type IDockviewPanelProps, type DockviewApi } from "dockview-react";
import "dockview-react/dist/styles/dockview.css";
import { ChevronDown, ChevronRight, Play, Square, RotateCw, FolderOpen, Command as CommandIcon } from "lucide-react";
import { STATUS_COLORS } from "../styles/theme";
import { resolveIcon } from "../utils/icons";
import { CommandPalette } from "./CommandPalette";

// ── Types ──

interface TabInfo {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly icon?: string;
  readonly status: string;
}

interface CategoryInfo {
  readonly name: string;
  readonly color: string;
  readonly icon?: string;
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
  if (!child) return <div className="p-5 text-muted-foreground/50 text-[13px]">Loading...</div>;
  return <>{child}</>;
}

const panelComponents = { process: DockviewProcessPanel };

// ── Header actions ──

function HeaderActions(): React.ReactElement {
  const actions = useContext(ProcessActionsContext);
  if (!actions) return <></>;
  const { activeStatus, start, stop, restart } = actions;
  const running = activeStatus === "running";
  const btn = "flex items-center justify-center w-5 h-5 rounded border-none p-0 bg-transparent text-muted-foreground/50 hover:text-foreground disabled:opacity-20 disabled:cursor-default cursor-pointer transition-colors";

  return (
    <div className="flex items-center gap-px px-1.5 ml-0.5 border-l border-border/30 h-full">
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
      <div className="flex flex-col gap-0.5 w-56">
        <div className="text-[10px] text-muted-foreground/30 uppercase tracking-wider font-medium px-3 mb-1">
          Categories
        </div>
        {categories.map((cat) => {
          const Icon = resolveIcon(cat.icon);
          return (
            <button
              key={cat.name}
              onClick={() => onOpen(cat.name)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-transparent hover:bg-card/80 transition-all duration-150 border border-transparent hover:border-border/30 text-left cursor-pointer group"
            >
              {Icon ? (
                <Icon size={13} className="text-muted-foreground/50 group-hover:text-foreground/60 shrink-0 transition-colors" />
              ) : (
                <span className="w-2 h-2 rounded-sm shrink-0 transition-transform group-hover:scale-110" style={{ background: cat.color }} />
              )}
              <span className="flex-1 text-foreground/80 text-[13px] group-hover:text-foreground transition-colors">{cat.name}</span>
              <span className="text-muted-foreground/25 text-[11px] tabular-nums">{cat.tabs.length}</span>
            </button>
          );
        })}
        <div className="flex items-center justify-center gap-1.5 mt-4 text-[10px] text-muted-foreground/20">
          <CommandIcon size={10} />
          <span>K to search</span>
        </div>
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
    <div className="w-[200px] min-w-[200px] bg-background border-r border-border/40 flex flex-col select-none overflow-y-auto">
      {categories.map((cat) => {
        const isActive = cat.name === activeCategory;
        const isCollapsed = collapsedCategories.has(cat.name);
        const CatIcon = resolveIcon(cat.icon);

        return (
          <div key={cat.name} className="mt-px">
            {/* Category header */}
            <div
              onClick={() => {
                onSelectCategory(cat.name);
                if (isCollapsed) onToggleCollapse(cat.name);
              }}
              className={`flex items-center gap-1 px-2 py-[5px] text-[11px] cursor-pointer transition-colors duration-100 ${
                isActive ? "text-foreground/70" : "text-muted-foreground/50 hover:text-muted-foreground/70"
              }`}
            >
              <span
                onClick={(e) => { e.stopPropagation(); onToggleCollapse(cat.name); }}
                className="flex items-center justify-center w-3.5 h-3.5 cursor-pointer shrink-0"
              >
                {isCollapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
              </span>
              {CatIcon ? (
                <CatIcon size={11} className="shrink-0 mr-0.5" />
              ) : (
                <span className="w-1.5 h-1.5 rounded-sm shrink-0 mr-0.5" style={{ background: cat.color }} />
              )}
              <span className="lowercase tracking-wide font-medium flex-1 truncate">{cat.name}</span>
              <span className="text-[10px] text-muted-foreground/20 tabular-nums pr-0.5">
                {cat.tabs.length}
              </span>
            </div>

            {/* Tab items */}
            {!isCollapsed && cat.tabs.map((tab) => {
              const isActiveTab = tab.id === activeTabId && isActive;
              const TabIcon = resolveIcon(tab.icon);
              return (
                <div
                  key={tab.id}
                  onClick={() => {
                    if (!isActive) onSelectCategory(cat.name);
                    onSelectTab(tab.id);
                  }}
                  className={`flex items-start gap-2 pl-5 pr-2 py-[3px] cursor-pointer transition-colors duration-100 ${
                    isActiveTab
                      ? "bg-card/80 text-foreground"
                      : "text-muted-foreground/60 hover:bg-card/40 hover:text-foreground/70"
                  }`}
                >
                  {TabIcon ? (
                    <TabIcon size={12} className="shrink-0 mt-[3px]" />
                  ) : (
                    <span
                      className="w-[5px] h-[5px] rounded-full shrink-0 mt-[7px]"
                      style={{ background: STATUS_COLORS[tab.status] ?? "#3f3f46" }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] leading-tight truncate">{tab.name}</div>
                    {tab.description && (
                      <div className="text-[10px] leading-tight text-muted-foreground/30 truncate">{tab.description}</div>
                    )}
                  </div>
                  {TabIcon && (
                    <span
                      className="w-[5px] h-[5px] rounded-full shrink-0 mt-[7px]"
                      style={{ background: STATUS_COLORS[tab.status] ?? "#3f3f46" }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Keyboard hint */}
      <div className="mt-auto py-2 px-3 border-t border-border/20">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/20">
          <kbd className="bg-background/50 px-1 py-px rounded border border-border/20 font-mono text-[9px]">⌘K</kbd>
          <span>Command palette</span>
        </div>
      </div>
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
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [fileViewerOpen, setFileViewerOpen] = useState(true);

  // Separate file viewer from terminal registry
  const { terminalRegistry, fileViewer } = useMemo(() => {
    const terms = new Map<string, ReactNode>();
    let fv: ReactNode | null = null;
    for (const child of React.Children.toArray(children) as React.ReactElement[]) {
      const id = (child.props as { id?: string }).id;
      if (id === "__files__") {
        fv = child;
      } else if (id) {
        terms.set(id, child);
      }
    }
    return { terminalRegistry: terms, fileViewer: fv };
  }, [children]);

  const hasFileViewer = fileViewer !== null;
  const activeCategoryData = categories.find((c) => c.name === activeCategory);
  const activeTabs = activeCategoryData?.tabs ?? [];
  const hasActiveCategory = activeCategory !== "";

  // Cmd+K handler
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdkOpen((prev) => !prev);
      }
      if (e.key === "Escape" && cmdkOpen) {
        setCmdkOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cmdkOpen]);

  // Sync dockview with active category
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

  // Sync active tab
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

      {/* Main content area */}
      <div className="flex-1 flex relative">
        <div className="flex-1 relative">
          {hasActiveCategory && activeTabs.length > 0 ? (
            <ProcessActionsContext.Provider value={processActions}>
              <TerminalRegistryContext.Provider value={terminalRegistry}>
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

        {/* File viewer right panel */}
        {hasFileViewer && fileViewerOpen && (
          <div className="w-[260px] min-w-[260px] border-l border-border/30 bg-background flex flex-col">
            <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border/30">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50 font-medium uppercase tracking-wider">
                <FolderOpen size={11} />
                <span>Files</span>
              </div>
              <button
                onClick={() => setFileViewerOpen(false)}
                className="flex items-center justify-center w-4 h-4 rounded bg-transparent border-none text-muted-foreground/30 hover:text-foreground/60 cursor-pointer transition-colors"
                title="Close file viewer"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {fileViewer}
            </div>
          </div>
        )}

        {/* File viewer toggle when closed */}
        {hasFileViewer && !fileViewerOpen && (
          <button
            onClick={() => setFileViewerOpen(true)}
            className="absolute top-1.5 right-1.5 flex items-center justify-center w-6 h-6 rounded-md bg-card/50 border border-border/20 text-muted-foreground/30 hover:text-foreground/60 hover:bg-card cursor-pointer transition-all z-10"
            title="Open file viewer"
          >
            <FolderOpen size={12} />
          </button>
        )}
      </div>

      {/* Command palette */}
      <CommandPalette
        open={cmdkOpen}
        onOpenChange={setCmdkOpen}
        categories={categories}
        activeTabId={activeTabId}
        onSelectCategory={selectCategory}
        onSelectTab={selectTab}
        onStartProcess={startProcess}
        onStopProcess={stopProcess}
        onRestartProcess={restartProcess}
        hasFileViewer={hasFileViewer}
        fileViewerOpen={fileViewerOpen}
        onToggleFileViewer={() => setFileViewerOpen((p) => !p)}
      />
    </div>
  );
}
