/** @jsxImportSource @opentui/react */
import React, { useState, useCallback, useMemo, useRef, type ReactNode } from "react";
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react";
import { Sidebar } from "./Sidebar";
import { StatusBar } from "./StatusBar";
import { PrefixProvider, useTUIContext } from "./FocusContext";
import { SearchOverlay } from "./SearchOverlay";
import { LocalFileViewer } from "./LocalFileViewer";
import type { CategoryInfo } from "../types";

const SIDEBAR_WIDTH = 30;
const BG = "#1c1c1e";
const HEADER_BG = "#232325";
const BORDER_COLOR = "#38383a";
const MUTED = "#98989d";

const openInBrowser = (url: string): void => {
  try {
    const cmd = process.platform === "darwin" ? "open" :
                process.platform === "win32" ? "cmd" : "xdg-open";
    const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
    Bun.spawn([cmd, ...args]);
  } catch {}
};

interface SidebarNavigationItem {
  readonly categoryName: string;
  readonly tabId: string;
}

const buildAllNavigationItems = (
  categories: ReadonlyArray<CategoryInfo>,
): readonly SidebarNavigationItem[] =>
  categories.flatMap((c) =>
    c.type === "files"
      ? (c.openFiles ?? []).map((file) => ({ categoryName: c.name, tabId: `file::${file.path}` }))
      : c.tabs.map((tab) => ({ categoryName: c.name, tabId: tab.id })),
  );

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
  const [prefixVisible, setPrefixVisible] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchOpenRef = useRef(false);
  const [copyMode, setCopyMode] = useState(false);
  const copyModeRef = useRef(false);
  const copyPrefixRef = useRef(false);
  const copyPrefixTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const terminalContentRef = useRef("");

  const activatePrefix = useCallback(() => {
    prefixRef.current = true;
    setPrefixVisible(true);
  }, []);

  const consumePrefix = useCallback(() => {
    prefixRef.current = false;
    setPrefixVisible(false);
  }, []);

  const handleSearchClose = useCallback(() => {
    searchOpenRef.current = false;
    setSearchOpen(false);
  }, []);

  const enterCopyMode = useCallback(() => {
    copyModeRef.current = true;
    setCopyMode(true);
    copyPrefixRef.current = false;
    if (copyPrefixTimerRef.current) {
      clearTimeout(copyPrefixTimerRef.current);
      copyPrefixTimerRef.current = null;
    }
  }, []);

  const exitCopyMode = useCallback(() => {
    copyModeRef.current = false;
    setCopyMode(false);
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

  const selectFirstInCategory = useCallback((cat: CategoryInfo) => {
    if (cat.type === "files") {
      const firstOpen = (cat.openFiles ?? [])[0];
      if (firstOpen) { selectTab(`file::${firstOpen.path}`); return; }
      const firstFile = (cat.fileEntries ?? []).find((e) => !e.isDir);
      if (firstFile) { selectTab(`file::${firstFile.path}`); openFile(firstFile.path); }
      return;
    }
    if (cat.tabs.length > 0) selectTab(cat.tabs[0]!.id);
  }, [selectTab, openFile]);

  const handleNavigate = useCallback((delta: number) => {
    const target = navigateItem(allNavItems, activeTabId, delta);
    if (!target) return;
    if (target.categoryName !== activeCategory) selectCategory(target.categoryName);
    selectTab(target.tabId);
    if (target.tabId.startsWith("file::")) openFile(target.tabId.slice(6));
  }, [allNavItems, activeTabId, activeCategory, selectCategory, selectTab, openFile]);

  useKeyboard((key) => {
    // ── Search overlay handles its own keys ──────────────
    if (searchOpenRef.current) return;

    // ── Copy mode: 'c' copies, Escape exits ────────────
    if (copyModeRef.current) {
      if (key.name === "c") {
        renderer.copyToClipboardOSC52(terminalContentRef.current);
        exitCopyMode();
      }
      if (key.name === "escape") exitCopyMode();
      return;
    }

    // ── Copy prefix: Ctrl+C was pressed, waiting for 'c' ──
    if (copyPrefixRef.current) {
      copyPrefixRef.current = false;
      if (copyPrefixTimerRef.current) {
        clearTimeout(copyPrefixTimerRef.current);
        copyPrefixTimerRef.current = null;
      }
      if (key.name === "c" && !key.ctrl) {
        enterCopyMode();
        return;
      }
      // Non-'c' key: fall through to normal handling
    }

    // ── Ctrl+C: set copy prefix (deferred so Ctrl+C reaches PTY) ──
    if (key.ctrl && key.name === "c" && !prefixRef.current) {
      setTimeout(() => { copyPrefixRef.current = true; }, 0);
      if (copyPrefixTimerRef.current) clearTimeout(copyPrefixTimerRef.current);
      copyPrefixTimerRef.current = setTimeout(() => {
        copyPrefixRef.current = false;
        copyPrefixTimerRef.current = null;
      }, 500);
      return;
    }

    // ── Ctrl+B: toggle control mode ─────────────────────
    if (key.ctrl && key.name === "b") {
      if (prefixRef.current) {
        consumePrefix();
      } else {
        activatePrefix();
      }
      return;
    }

    // ── Not in control mode: all keys pass through to terminal
    if (!prefixRef.current) return;

    // ── Control mode commands (persistent until Enter/Esc) ──

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
        selectFirstInCategory(cat);
      }
      return;
    }

    // Next/prev category
    if (key.name === "tab" || key.name === "]") {
      const catIdx = categories.findIndex((c) => c.name === activeCategory);
      const nextIdx = (catIdx + 1) % categories.length;
      const nextCat = categories[nextIdx]!;
      selectCategory(nextCat.name);
      selectFirstInCategory(nextCat);
      return;
    }
    if (key.name === "[") {
      const catIdx = categories.findIndex((c) => c.name === activeCategory);
      const prevIdx = (catIdx - 1 + categories.length) % categories.length;
      const prevCat = categories[prevIdx]!;
      selectCategory(prevCat.name);
      selectFirstInCategory(prevCat);
      return;
    }

    // Process controls
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

    // Search overlay
    if (key.name === "f") {
      consumePrefix();
      searchOpenRef.current = true;
      setSearchOpen(true);
      return;
    }

    // Open web URL in browser
    if (key.name === "w" && webUrl) {
      openInBrowser(webUrl);
      return;
    }

    // Copy mode
    if (key.name === "c") {
      consumePrefix();
      enterCopyMode();
      return;
    }

    // Exit control mode (+ start process if idle)
    if (key.name === "enter" || key.name === "return") {
      const activeCat = categories.find((c) => c.name === activeCategory);
      if (activeCat?.type === "files") {
        const firstFile = (activeCat.fileEntries ?? []).find((e) => !e.isDir);
        if (firstFile) openFile(firstFile.path);
      } else {
        const activeTab = activeCat?.tabs.find((t) => t.id === activeTabId);
        if (activeTab?.status === "idle") startProcess(activeTabId);
      }
      consumePrefix();
      return;
    }

    // Exit control mode
    if (key.name === "escape") {
      consumePrefix();
      return;
    }

    // Quit
    if (key.name === "q") {
      renderer.destroy();
      return;
    }
  });

  const hasActiveChild = registry.has(activeTabId);

  return (
    <PrefixProvider prefixRef={prefixRef} searchOpenRef={searchOpenRef} copyModeRef={copyModeRef} terminalContentRef={terminalContentRef} activeTabId={activeTabId} copyMode={copyMode}>
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

          {/* Content area — all children stay mounted, inactive ones hidden */}
          <box flexGrow={1} flexDirection="column">
            {searchOpen ? (
              <SearchOverlay
                categories={categories}
                onSelectCategory={selectCategory}
                onSelectTab={selectTab}
                onOpenFile={openFile}
                onClose={handleSearchClose}
              />
            ) : null}
            {React.Children.map(children, (child) => {
              const childId = ((child as React.ReactElement).props as { id?: string }).id;
              if (!childId) return null;
              if (searchOpen || childId !== activeTabId) return null;
              return child;
            })}
            {!searchOpen && !hasActiveChild && (
              activeTabId.startsWith("file::") ? (
                <LocalFileViewer filePath={activeTabId.slice(6)} />
              ) : (
                <box flexGrow={1} justifyContent="center" alignItems="center">
                  <text fg="#636366">No active tab</text>
                </box>
              )
            )}
          </box>
        </box>

        {/* Separator */}
        <box height={1} backgroundColor={BORDER_COLOR} />

        {/* Status bar */}
        <StatusBar prefixActive={prefixVisible} copyMode={copyMode} />
      </box>
    </PrefixProvider>
  );
};
