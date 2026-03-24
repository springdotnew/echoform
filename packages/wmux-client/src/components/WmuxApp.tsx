import React, { useEffect, useMemo, useCallback, useState, type ReactNode } from "react";
import { Command as CommandIcon, Search } from "lucide-react";
import { resolveIcon } from "../utils/icons";
import { CommandPalette } from "./CommandPalette";
import { Sidebar } from "./Sidebar";
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

// ── Top bar ──

function TopBar({ title, description, onSearch }: {
  readonly title: string;
  readonly description: string;
  readonly onSearch: () => void;
}): React.ReactElement {
  const label = description ? `${title} — ${description}` : title;

  return (
    <div className="h-10 shrink-0 flex items-center justify-center border-b border-border/20 bg-background relative">
      <button
        onClick={onSearch}
        className="flex items-center gap-2 px-3 py-1 rounded-md border border-border/30 bg-card/40 hover:bg-card/70 transition-colors cursor-pointer text-muted-foreground/50 hover:text-muted-foreground/70 max-w-[400px] min-w-[260px]"
      >
        <Search size={12} className="shrink-0" />
        <span className="text-[12px] truncate flex-1 text-left">Search {label}...</span>
        <div className="flex items-center gap-0.5 shrink-0">
          <kbd className="text-[10px] bg-background/60 px-1 py-px rounded border border-border/30 font-mono">
            <CommandIcon size={9} className="inline" />
          </kbd>
          <kbd className="text-[10px] bg-background/60 px-1 py-px rounded border border-border/30 font-mono">K</kbd>
        </div>
      </button>
    </div>
  );
}

// ── Main component ──

export function WmuxApp(props: {
  readonly title: string;
  readonly description: string;
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
  const { title, description, categories, activeCategory, activeTabId, children } = props;
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

  // Build flat navigable sidebar item list (tabs only, across all visible categories)
  const sidebarItems = useMemo(() => {
    const items: Array<{ readonly categoryName: string; readonly tabId: string }> = [];
    for (const cat of categories) {
      if (collapsedCategories.has(cat.name) || cat.type === "files") continue;
      for (const tab of cat.tabs) {
        items.push({ categoryName: cat.name, tabId: tab.id });
      }
    }
    return items;
  }, [categories, collapsedCategories]);

  // Keyboard shortcuts
  useEffect(() => {
    const isTerminalFocused = (): boolean => {
      const el = document.activeElement;
      return el != null && el.closest(".xterm") != null;
    };

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
        return;
      }

      // Arrow key sidebar navigation (only when terminal is not focused)
      if ((e.key === "ArrowUp" || e.key === "ArrowDown") && !isTerminalFocused() && !cmdkOpen && sidebarItems.length > 0) {
        e.preventDefault();
        const currentIdx = sidebarItems.findIndex((item) => item.tabId === activeTabId);
        const delta = e.key === "ArrowDown" ? 1 : -1;
        const nextIdx = currentIdx === -1
          ? 0
          : (currentIdx + delta + sidebarItems.length) % sidebarItems.length;
        const next = sidebarItems[nextIdx]!;
        if (next.categoryName !== activeCategory) selectCategory(next.categoryName);
        selectTab(next.tabId);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cmdkOpen, categories, selectCategory, orderedTabs, activeTabId, selectTab, sidebarItems, activeCategory]);

  const toggleCollapse = useCallback((name: string) => {
    setCollapsedCategories((prev) => { const next = new Set(prev); next.has(name) ? next.delete(name) : next.add(name); return next; });
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen bg-background text-foreground font-sans">
      <TopBar title={title} description={description} onSearch={() => setCmdkOpen(true)} />

      <div className="flex flex-1 min-h-0">
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

        <div className="flex-1 min-h-0 relative bg-background">
          {[...registry.entries()].map(([id, child]) => (
            <div
              key={id}
              className="absolute inset-0"
              style={{ visibility: id === activeTabId ? "visible" : "hidden", zIndex: id === activeTabId ? 1 : 0 }}
            >
              {child}
            </div>
          ))}

          {(!activeCategory || !hasTabs) && (
            <div className="absolute inset-0 z-10">
              <EmptyState categories={categories} onOpen={selectCategory} />
            </div>
          )}
        </div>
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
        onOpenFile={openFile}
      />
    </div>
  );
}
