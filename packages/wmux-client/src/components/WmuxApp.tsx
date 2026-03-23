import React, { useEffect, useMemo, useCallback, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Command as CommandIcon } from "lucide-react";
import { STATUS_COLORS } from "../styles/theme";
import { resolveIcon } from "../utils/icons";
import { CommandPalette } from "./CommandPalette";
import { FileTree } from "./FileViewer";
import { TabBar, type Tab } from "./TabBar";

// ── Types ──

interface FileEntry {
  readonly path: string;
  readonly name: string;
  readonly isDir: boolean;
  readonly depth: number;
  readonly isExpanded: boolean;
}

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
  readonly type: string;
  readonly tabs: readonly TabInfo[];
  readonly fileEntries?: readonly FileEntry[];
  readonly openFiles?: readonly { readonly path: string; readonly name: string }[];
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
  onToggleDir,
  onOpenFile,
}: {
  readonly categories: ReadonlyArray<CategoryInfo>;
  readonly activeCategory: string;
  readonly activeTabId: string;
  readonly collapsedCategories: ReadonlySet<string>;
  readonly onSelectCategory: (name: string) => void;
  readonly onToggleCollapse: (name: string) => void;
  readonly onSelectTab: (id: string) => void;
  readonly onToggleDir: (path: string) => void;
  readonly onOpenFile: (path: string) => void;
}): React.ReactElement {
  return (
    <div className="w-[200px] min-w-[200px] bg-background border-r border-border/40 flex flex-col select-none overflow-y-auto">
      {categories.map((cat) => {
        const isActive = cat.name === activeCategory;
        const isCollapsed = collapsedCategories.has(cat.name);
        const CatIcon = resolveIcon(cat.icon);
        const isFiles = cat.type === "files";

        return (
          <div key={cat.name} className="mt-px">
            <div
              onClick={() => { onSelectCategory(cat.name); if (isCollapsed) onToggleCollapse(cat.name); }}
              className={`flex items-center gap-1 px-2 py-[5px] text-[11px] cursor-pointer transition-colors duration-100 ${
                isActive ? "text-foreground/70" : "text-muted-foreground/50 hover:text-muted-foreground/70"
              }`}
            >
              <span onClick={(e) => { e.stopPropagation(); onToggleCollapse(cat.name); }} className="flex items-center justify-center w-3.5 h-3.5 cursor-pointer shrink-0">
                {isCollapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
              </span>
              {CatIcon ? <CatIcon size={11} className="shrink-0 mr-0.5" /> : <span className="w-1.5 h-1.5 rounded-sm shrink-0 mr-0.5" style={{ background: cat.color }} />}
              <span className="lowercase tracking-wide font-medium flex-1 truncate">{cat.name}</span>
              <span className="text-[10px] text-muted-foreground/20 tabular-nums pr-0.5">
                {isFiles ? (cat.openFiles?.length ?? 0) : cat.tabs.length}
              </span>
            </div>

            {!isCollapsed && isFiles && cat.fileEntries && (
              <div className="max-h-[50vh] overflow-y-auto">
                <FileTree
                  entries={cat.fileEntries}
                  onToggleDir={(path) => { if (!isActive) onSelectCategory(cat.name); onToggleDir(path); }}
                  onOpenFile={(path) => { if (!isActive) onSelectCategory(cat.name); onOpenFile(path); }}
                />
              </div>
            )}

            {!isCollapsed && !isFiles && cat.tabs.map((tab) => {
              const isActiveTab = tab.id === activeTabId && isActive;
              const TabIcon = resolveIcon(tab.icon);
              return (
                <div
                  key={tab.id}
                  onClick={() => { if (!isActive) onSelectCategory(cat.name); onSelectTab(tab.id); }}
                  className={`flex items-center gap-2.5 pl-5 pr-2 py-[7px] cursor-pointer transition-colors duration-100 rounded-sm mx-1 ${
                    isActiveTab ? "bg-card/80 text-foreground" : "text-muted-foreground/60 hover:bg-card/40 hover:text-foreground/70"
                  }`}
                >
                  {TabIcon ? <TabIcon size={14} className="shrink-0" /> : <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: STATUS_COLORS[tab.status] ?? "#3f3f46" }} />}
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] leading-snug truncate">{tab.name}</div>
                    {tab.description && <div className="text-[10px] leading-snug text-muted-foreground/30 truncate mt-px">{tab.description}</div>}
                  </div>
                  {TabIcon && <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: STATUS_COLORS[tab.status] ?? "#3f3f46" }} />}
                </div>
              );
            })}
          </div>
        );
      })}

      <div className="mt-auto py-2 px-2.5 border-t border-border/20 flex flex-col gap-1">
        {[["⌘K", "Command palette"], ["⌘1-9", "Switch category"], ["⌘[]", "Switch tab"]].map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5 text-[10px] text-muted-foreground/20">
            <kbd className="bg-background/50 px-1 py-px rounded border border-border/20 font-mono text-[9px]">{key}</kbd>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Empty state ──

function EmptyState({ categories, onOpen }: {
  readonly categories: ReadonlyArray<CategoryInfo>;
  readonly onOpen: (name: string) => void;
}): React.ReactElement {
  return (
    <div className="flex items-center justify-center h-full w-full">
      <div className="flex flex-col gap-0.5 w-56">
        <div className="text-[10px] text-muted-foreground/30 uppercase tracking-wider font-medium px-3 mb-1">Categories</div>
        {categories.map((cat) => {
          const Icon = resolveIcon(cat.icon);
          return (
            <button key={cat.name} onClick={() => onOpen(cat.name)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-transparent hover:bg-card/80 transition-all duration-150 border border-transparent hover:border-border/30 text-left cursor-pointer group">
              {Icon ? <Icon size={13} className="text-muted-foreground/50 group-hover:text-foreground/60 shrink-0 transition-colors" /> : <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: cat.color }} />}
              <span className="flex-1 text-foreground/80 text-[13px] group-hover:text-foreground transition-colors">{cat.name}</span>
            </button>
          );
        })}
        <div className="flex items-center justify-center gap-1.5 mt-4 text-[10px] text-muted-foreground/20">
          <CommandIcon size={10} /><span>K to search</span>
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
  readonly onToggleDir: { readonly mutate: (path: string) => void };
  readonly onOpenFile: { readonly mutate: (path: string) => void };
  readonly onCloseFile: { readonly mutate: (path: string) => void };
}): React.ReactElement {
  const { categories, activeCategory, activeTabId, children } = props;
  const selectCategory = props.onSelectCategory.mutate;
  const selectTab = props.onSelectTab.mutate;
  const startProcess = props.onStartProcess.mutate;
  const stopProcess = props.onStopProcess.mutate;
  const restartProcess = props.onRestartProcess.mutate;
  const toggleDir = props.onToggleDir.mutate;
  const openFile = props.onOpenFile.mutate;
  const closeFile = props.onCloseFile.mutate;

  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [tabOrder, setTabOrder] = useState<string[]>([]);

  // Child registry
  const registry = useMemo(() => {
    const map = new Map<string, ReactNode>();
    for (const child of React.Children.toArray(children) as React.ReactElement[]) {
      const id = (child.props as { id?: string }).id;
      if (id) map.set(id, child);
    }
    return map;
  }, [children]);

  // Derived state
  const activeCat = categories.find((c) => c.name === activeCategory);
  const isFiles = activeCat?.type === "files";
  const processTabs = activeCat?.tabs ?? [];
  const openFiles = activeCat?.openFiles ?? [];

  // Build tab list for the tab bar
  const tabs: Tab[] = isFiles
    ? openFiles.map((f) => ({ id: `file::${f.path}`, title: f.name, closable: true }))
    : processTabs.map((t) => ({ id: t.id, title: t.name }));

  // Stable key for tab IDs — only triggers effect when tabs are actually added/removed
  const tabIdsKey = tabs.map((t) => t.id).join("\0");

  // Sync tabOrder when tabs are added or removed
  useEffect(() => {
    setTabOrder((prev) => {
      const ids = new Set(tabs.map((t) => t.id));
      const kept = prev.filter((id) => ids.has(id));
      const added = tabs.map((t) => t.id).filter((id) => !kept.includes(id));
      return [...kept, ...added];
    });
  }, [tabIdsKey]);

  const orderedTabs = useMemo(() => {
    const byId = new Map(tabs.map((t) => [t.id, t]));
    return tabOrder.filter((id) => byId.has(id)).map((id) => byId.get(id)!);
  }, [tabIdsKey, tabOrder]);

  const hasTabs = orderedTabs.length > 0;

  // Process actions for active tab
  const activeTabInfo = processTabs.find((t) => t.id === activeTabId);
  const processActions = !isFiles && activeTabInfo ? {
    status: activeTabInfo.status,
    onStart: () => startProcess(activeTabId),
    onStop: () => stopProcess(activeTabId),
    onRestart: () => restartProcess(activeTabId),
  } : null;

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "k") { e.preventDefault(); setCmdkOpen((p) => !p); return; }
      if (e.key === "Escape" && cmdkOpen) { setCmdkOpen(false); return; }
      if (mod && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        const idx = parseInt(e.key, 10) - 1;
        if (idx < categories.length) selectCategory(categories[idx]!.name);
        return;
      }
      if (mod && (e.key === "[" || e.key === "]")) {
        e.preventDefault();
        if (orderedTabs.length === 0) return;
        const idx = orderedTabs.findIndex((t) => t.id === activeTabId);
        const next = e.key === "]" ? (idx + 1) % orderedTabs.length : (idx - 1 + orderedTabs.length) % orderedTabs.length;
        selectTab(orderedTabs[next]!.id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cmdkOpen, categories, selectCategory, orderedTabs, activeTabId, selectTab]);

  const toggleCollapse = useCallback((name: string) => {
    setCollapsedCategories((prev) => { const next = new Set(prev); next.has(name) ? next.delete(name) : next.add(name); return next; });
  }, []);

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
        onToggleDir={toggleDir}
        onOpenFile={openFile}
      />

      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Tab bar */}
        {activeCategory && hasTabs && (
          <TabBar
            tabs={orderedTabs}
            activeId={activeTabId}
            categoryColor={activeCat?.color ?? "#3f3f46"}
            onSelect={selectTab}
            onClose={isFiles ? closeFile : undefined}
            onReorder={setTabOrder}
            processActions={processActions}
          />
        )}

        {/* Content — all children always mounted, only active visible */}
        <div className="flex-1 min-h-0 relative">
          {[...registry.entries()].map(([id, child]) => (
            <div
              key={id}
              className="absolute inset-0"
              style={{ visibility: id === activeTabId ? "visible" : "hidden", zIndex: id === activeTabId ? 1 : 0 }}
            >
              {child}
            </div>
          ))}

          {/* Empty state overlay */}
          {(!activeCategory || !hasTabs) && (
            <div className="absolute inset-0 z-10">
              <EmptyState categories={categories} onOpen={selectCategory} />
            </div>
          )}
        </div>
      </div>

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
      />
    </div>
  );
}
