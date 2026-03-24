import React, { useEffect, useMemo, useCallback, useState, type ReactNode } from "react";
import { Command as CommandIcon, Search } from "lucide-react";
import { resolveIcon } from "../utils/icons";
import { CommandPalette } from "./CommandPalette";
import { Sidebar } from "./Sidebar";
import { TabBar, type Tab } from "./TabBar";
import type { CategoryInfo } from "../types";

function EmptyState({ categories, onOpen }: {
  readonly categories: ReadonlyArray<CategoryInfo>;
  readonly onOpen: (name: string) => void;
}): React.ReactElement {
  return (
    <div className="flex items-center justify-center h-full w-full">
      <div className="flex flex-col gap-0.5 w-56">
        <div className="text-[10px] text-muted-foreground/30 uppercase tracking-wider font-medium px-3 mb-1">Categories</div>
        {categories.map((category) => {
          const Icon = resolveIcon(category.icon);
          return (
            <button key={category.name} onClick={() => onOpen(category.name)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-transparent hover:bg-card/80 transition-all duration-150 border border-transparent hover:border-border/30 text-left cursor-pointer group">
              {Icon ? <Icon size={13} className="text-muted-foreground/50 group-hover:text-foreground/60 shrink-0 transition-colors" /> : <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: category.color }} />}
              <span className="flex-1 text-foreground/80 text-[13px] group-hover:text-foreground transition-colors">{category.name}</span>
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

interface SidebarNavigationItem {
  readonly categoryName: string;
  readonly tabId: string;
}

function buildSidebarNavigationItems(
  categories: ReadonlyArray<CategoryInfo>,
  collapsedCategories: ReadonlySet<string>,
): readonly SidebarNavigationItem[] {
  const items: SidebarNavigationItem[] = [];
  for (const category of categories) {
    if (collapsedCategories.has(category.name) || category.type === "files") continue;
    for (const tab of category.tabs) {
      items.push({ categoryName: category.name, tabId: tab.id });
    }
  }
  return items;
}

function buildTabList(activeCategory: CategoryInfo | undefined): Tab[] {
  if (!activeCategory) return [];
  if (activeCategory.type === "files") {
    return (activeCategory.openFiles ?? []).map((f) => ({ id: `file::${f.path}`, title: f.name, closable: true }));
  }
  return activeCategory.tabs.map((t) => ({ id: t.id, title: t.name }));
}

function syncTabOrder(previousOrder: readonly string[], currentTabs: readonly Tab[]): string[] {
  const currentIds = new Set(currentTabs.map((t) => t.id));
  const kept = previousOrder.filter((id) => currentIds.has(id));
  const added = currentTabs.map((t) => t.id).filter((id) => !kept.includes(id));
  return [...kept, ...added];
}

function isTerminalFocused(): boolean {
  const activeElement = document.activeElement;
  return activeElement != null && activeElement.closest(".xterm") != null;
}

function toggleSetItem<T>(source: ReadonlySet<T>, item: T): Set<T> {
  if (source.has(item)) return new Set([...source].filter((entry) => entry !== item));
  return new Set([...source, item]);
}

function useKeyboardShortcuts({
  commandPaletteOpen,
  setCommandPaletteOpen,
  categories,
  selectCategory,
  orderedTabs,
  activeTabId,
  selectTab,
  sidebarItems,
  activeCategory,
}: {
  readonly commandPaletteOpen: boolean;
  readonly setCommandPaletteOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  readonly categories: ReadonlyArray<CategoryInfo>;
  readonly selectCategory: (name: string) => void;
  readonly orderedTabs: readonly Tab[];
  readonly activeTabId: string;
  readonly selectTab: (id: string) => void;
  readonly sidebarItems: readonly SidebarNavigationItem[];
  readonly activeCategory: string;
}): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      const isModifierPressed = event.metaKey || event.ctrlKey;

      if (isModifierPressed && event.key === "k") { event.preventDefault(); setCommandPaletteOpen((prev: boolean) => !prev); return; }
      if (event.key === "Escape" && commandPaletteOpen) { setCommandPaletteOpen(false); return; }

      if (isModifierPressed && event.key >= "1" && event.key <= "9") {
        event.preventDefault();
        const categoryIndex = parseInt(event.key, 10) - 1;
        if (categoryIndex < categories.length) selectCategory(categories[categoryIndex]!.name);
        return;
      }

      if (isModifierPressed && (event.key === "[" || event.key === "]")) {
        event.preventDefault();
        if (orderedTabs.length === 0) return;
        const currentIndex = orderedTabs.findIndex((t) => t.id === activeTabId);
        const nextIndex = event.key === "]"
          ? (currentIndex + 1) % orderedTabs.length
          : (currentIndex - 1 + orderedTabs.length) % orderedTabs.length;
        selectTab(orderedTabs[nextIndex]!.id);
        return;
      }

      const isArrowNavigation = (event.key === "ArrowUp" || event.key === "ArrowDown")
        && !isTerminalFocused()
        && !commandPaletteOpen
        && sidebarItems.length > 0;
      if (!isArrowNavigation) return;

      event.preventDefault();
      const currentIndex = sidebarItems.findIndex((item) => item.tabId === activeTabId);
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = currentIndex === -1
        ? 0
        : (currentIndex + delta + sidebarItems.length) % sidebarItems.length;
      const nextItem = sidebarItems[nextIndex]!;
      if (nextItem.categoryName !== activeCategory) selectCategory(nextItem.categoryName);
      selectTab(nextItem.tabId);
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [commandPaletteOpen, categories, selectCategory, orderedTabs, activeTabId, selectTab, sidebarItems, activeCategory, setCommandPaletteOpen]);
}

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
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [tabOrder, setTabOrder] = useState<string[]>([]);

  const registry = useMemo(() => {
    const map = new Map<string, ReactNode>();
    for (const child of React.Children.toArray(children) as React.ReactElement[]) {
      const id = (child.props as { id?: string }).id;
      if (id) map.set(id, child);
    }
    return map;
  }, [children]);

  const activeCategoryInfo = categories.find((c) => c.name === activeCategory);
  const isFileCategory = activeCategoryInfo?.type === "files";
  const processTabs = activeCategoryInfo?.tabs ?? [];
  const openFiles = activeCategoryInfo?.openFiles ?? [];

  const tabs = buildTabList(activeCategoryInfo);
  const tabIdsKey = tabs.map((t) => t.id).join("\0");

  useEffect(() => {
    setTabOrder((prev) => syncTabOrder(prev, tabs));
  }, [tabIdsKey]);

  const orderedTabs = useMemo(() => {
    const byId = new Map(tabs.map((t) => [t.id, t]));
    return tabOrder.filter((id) => byId.has(id)).map((id) => byId.get(id)!);
  }, [tabIdsKey, tabOrder]);

  const hasTabs = orderedTabs.length > 0;

  const activeTabInfo = processTabs.find((t) => t.id === activeTabId);
  const processActions = !isFileCategory && activeTabInfo ? {
    status: activeTabInfo.status,
    onStart: () => startProcess(activeTabId),
    onStop: () => stopProcess(activeTabId),
    onRestart: () => restartProcess(activeTabId),
  } : null;

  const sidebarItems = useMemo(
    () => buildSidebarNavigationItems(categories, collapsedCategories),
    [categories, collapsedCategories],
  );

  useKeyboardShortcuts({
    commandPaletteOpen,
    setCommandPaletteOpen,
    categories,
    selectCategory,
    orderedTabs,
    activeTabId,
    selectTab,
    sidebarItems,
    activeCategory,
  });

  const toggleCollapse = useCallback((name: string) => {
    setCollapsedCategories((prev) => toggleSetItem(prev, name));
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen bg-background text-foreground font-sans">
      <TopBar title={title} description={description} onSearch={() => setCommandPaletteOpen(true)} />

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
            categoryColor={activeCategoryInfo?.color ?? "#3f3f46"}
            onSelect={selectTab}
            onClose={isFileCategory ? closeFile : undefined}
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
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
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
