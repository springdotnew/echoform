/** @jsxImportSource @opentui/react */
import React, { useState, useCallback, useMemo, useRef, type ReactNode } from "react";
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react";
import { Sidebar } from "./Sidebar";
import { StatusBar } from "./StatusBar";
import { PrefixProvider, useTUIContext } from "./FocusContext";
import type { CategoryInfo } from "../types";

const SIDEBAR_WIDTH = 30;
const PREFIX_TIMEOUT_MS = 2000;
const BG = "#1c1c1e";
const HEADER_BG = "#232325";
const BORDER_COLOR = "#38383a";
const MUTED = "#98989d";

interface SidebarNavigationItem {
  readonly categoryName: string;
  readonly tabId: string;
}

const buildAllNavigationItems = (
  categories: ReadonlyArray<CategoryInfo>,
): readonly SidebarNavigationItem[] =>
  categories
    .filter((c) => c.type !== "files")
    .flatMap((c) => c.tabs.map((tab) => ({ categoryName: c.name, tabId: tab.id })));

const navigateItem = (
  items: readonly SidebarNavigationItem[],
  activeTabId: string,
  delta: number,
): SidebarNavigationItem | undefined => {
  if (items.length === 0) return undefined;
  const currentIndex = items.findIndex((item) => item.tabId === activeTabId);
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + delta + items.length) % items.length;
  return items[nextIndex];
};

export const WmuxApp = (props: {
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
}): ReactNode => {
  const { title, description, categories, activeCategory, activeTabId, children } = props;
  const selectCategory = props.onSelectCategory.mutate;
  const selectTab = props.onSelectTab.mutate;
  const startProcess = props.onStartProcess.mutate;
  const stopProcess = props.onStopProcess.mutate;
  const restartProcess = props.onRestartProcess.mutate;
  const openFile = props.onOpenFile.mutate;

  const renderer = useRenderer();
  const { width, height } = useTerminalDimensions();
  const { webUrl } = useTUIContext();

  // Prefix key state — ref for synchronous reads across useKeyboard handlers
  const prefixRef = useRef(false);
  const prefixTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [prefixVisible, setPrefixVisible] = useState(false);

  const activatePrefix = useCallback(() => {
    prefixRef.current = true;
    setPrefixVisible(true);
    if (prefixTimerRef.current) clearTimeout(prefixTimerRef.current);
    prefixTimerRef.current = setTimeout(() => {
      prefixRef.current = false;
      setPrefixVisible(false);
      prefixTimerRef.current = null;
    }, PREFIX_TIMEOUT_MS);
  }, []);

  const consumePrefix = useCallback(() => {
    prefixRef.current = false;
    setPrefixVisible(false);
    if (prefixTimerRef.current) {
      clearTimeout(prefixTimerRef.current);
      prefixTimerRef.current = null;
    }
  }, []);

  const allNavItems = useMemo(() => buildAllNavigationItems(categories), [categories]);

  const registry = useMemo(() => {
    const map = new Map<string, ReactNode>();
    for (const child of React.Children.toArray(children) as React.ReactElement[]) {
      const id = (child.props as { id?: string }).id;
      if (id) map.set(id, child);
    }
    return map;
  }, [children]);

  const handleNavigate = useCallback((delta: number) => {
    const target = navigateItem(allNavItems, activeTabId, delta);
    if (!target) return;
    if (target.categoryName !== activeCategory) selectCategory(target.categoryName);
    selectTab(target.tabId);
  }, [allNavItems, activeTabId, activeCategory, selectCategory, selectTab]);

  useKeyboard((key) => {
    // ── Ctrl+B: activate prefix ──────────────────────────
    if (key.ctrl && key.name === "b") {
      activatePrefix();
      return;
    }

    // ── Not in prefix mode: all keys pass through to terminal
    if (!prefixRef.current) return;

    // ── Prefix mode: interpret next key as TUI command ───
    consumePrefix();

    // Navigation
    if (key.name === "j" || key.name === "down" || key.name === "n") {
      handleNavigate(1);
      return;
    }
    if (key.name === "k" || key.name === "up" || key.name === "p") {
      handleNavigate(-1);
      return;
    }

    // Category by number
    if (key.name >= "1" && key.name <= "9") {
      const idx = parseInt(key.name, 10) - 1;
      if (idx < categories.length) {
        const cat = categories[idx]!;
        selectCategory(cat.name);
        if (cat.type !== "files" && cat.tabs.length > 0) {
          selectTab(cat.tabs[0]!.id);
        }
      }
      return;
    }

    // Next/prev category
    if (key.name === "tab" || key.name === "]") {
      const catIdx = categories.findIndex((c) => c.name === activeCategory);
      const nextIdx = (catIdx + 1) % categories.length;
      const nextCat = categories[nextIdx]!;
      selectCategory(nextCat.name);
      if (nextCat.type !== "files" && nextCat.tabs.length > 0) {
        selectTab(nextCat.tabs[0]!.id);
      }
      return;
    }
    if (key.name === "[") {
      const catIdx = categories.findIndex((c) => c.name === activeCategory);
      const prevIdx = (catIdx - 1 + categories.length) % categories.length;
      const prevCat = categories[prevIdx]!;
      selectCategory(prevCat.name);
      if (prevCat.type !== "files" && prevCat.tabs.length > 0) {
        selectTab(prevCat.tabs[0]!.id);
      }
      return;
    }

    // Process controls
    if (key.name === "enter") {
      const activeCat = categories.find((c) => c.name === activeCategory);
      if (!activeCat) return;
      if (activeCat.type === "files") {
        const firstFile = (activeCat.fileEntries ?? []).find((e) => !e.isDir);
        if (firstFile) openFile(firstFile.path);
        return;
      }
      const activeTab = activeCat.tabs.find((t) => t.id === activeTabId);
      if (activeTab?.status === "idle") startProcess(activeTabId);
      return;
    }

    if (key.name === "r") {
      const activeCat = categories.find((c) => c.name === activeCategory);
      const activeTab = activeCat?.tabs.find((t) => t.id === activeTabId);
      if (activeTab?.status === "running") restartProcess(activeTabId);
      return;
    }

    if (key.name === "s") {
      const activeCat = categories.find((c) => c.name === activeCategory);
      const activeTab = activeCat?.tabs.find((t) => t.id === activeTabId);
      if (activeTab?.status === "running") stopProcess(activeTabId);
      return;
    }

    // Quit
    if (key.name === "q") {
      renderer.destroy();
      return;
    }

    // Ctrl+B Ctrl+B → send literal Ctrl+B to terminal
    if (key.ctrl && key.name === "b") {
      // Will be picked up by WmuxTerminal on next event since prefix is now false
      return;
    }
  });

  const activeChild = registry.get(activeTabId);

  return (
    <PrefixProvider prefixRef={prefixRef} activeTabId={activeTabId}>
      <box
        flexDirection="column"
        width={width}
        height={height}
        backgroundColor={BG}
      >
        {/* Top bar */}
        <box height={1} flexDirection="row" paddingX={1} backgroundColor={HEADER_BG} justifyContent="space-between">
          <text fg="#f5f5f7">
            <strong>{title}</strong>
            {description ? <span fg={MUTED}>{" \u2014 "}{description}</span> : null}
          </text>
          {webUrl ? (
            <text fg="#636366">
              <a href={webUrl}>{"\u2197 web"}</a>
            </text>
          ) : null}
        </box>

        {/* Main area */}
        <box flexDirection="row" flexGrow={1}>
          <Sidebar
            categories={categories}
            activeCategory={activeCategory}
            activeTabId={activeTabId}
            width={SIDEBAR_WIDTH}
          />

          {/* Content area */}
          <box flexGrow={1} flexDirection="column">
            {activeChild ?? (
              <box flexGrow={1} justifyContent="center" alignItems="center">
                <text fg="#636366">No active tab</text>
              </box>
            )}
          </box>
        </box>

        {/* Separator */}
        <box height={1} backgroundColor={BORDER_COLOR} />

        {/* Status bar */}
        <StatusBar prefixActive={prefixVisible} />
      </box>
    </PrefixProvider>
  );
};
