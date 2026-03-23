import React, { useEffect, useRef, useMemo, useCallback, createContext, useContext, useState, type ReactNode } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { DockviewReact, type DockviewReadyEvent, type IDockviewPanelProps, type DockviewApi } from "dockview-react";
import "dockview-react/dist/styles/dockview.css";
import { Plus } from "lucide-react";
import type { InferClientProps } from "@react-fullstack/fullstack/client";
import type { TerminalApp as TerminalAppDef, Terminal as TerminalDef } from "../shared/views";

// ── Base64 ──

function toBase64(data: Uint8Array): string {
  let b = "";
  for (let i = 0; i < data.length; i++) b += String.fromCharCode(data[i]!);
  return btoa(b);
}

function fromBase64(b64: string): Uint8Array {
  const b = atob(b64);
  const a = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
  return a;
}

// ── Bridge: react-fullstack Terminal children → dockview panels ──
// Each Terminal child rendered by react-fullstack registers itself here.
// The dockview panel component looks up and renders the registered element.

type TerminalRegistry = ReadonlyMap<string, ReactNode>;
const TerminalRegistryContext = createContext<TerminalRegistry>(new Map());
const NewTabContext = createContext<() => void>(() => {});

// ── TerminalApp ──

export function TerminalApp(props: InferClientProps<typeof TerminalAppDef>): React.ReactElement {
  const { tabs, activeTabId, children } = props;
  const newTab = props.onNewTab.mutate;
  const closeTab = props.onCloseTab.mutate;
  const selectTab = props.onSelectTab.mutate;

  const apiRef = useRef<DockviewApi | null>(null);
  const syncedRef = useRef<Set<string>>(new Set());

  // Build registry from children — new Map each time so context consumers re-render
  const registry = useMemo(() => {
    const map = new Map<string, ReactNode>();
    const childArray = React.Children.toArray(children) as React.ReactElement[];
    for (const child of childArray) {
      const id = (child.props as { id?: string }).id;
      if (id) map.set(id, child);
    }
    return map;
  }, [children]);

  // Sync tabs → dockview panels
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;

    const serverIds = new Set(tabs.map((t) => t.id));

    for (const tab of tabs) {
      if (!syncedRef.current.has(tab.id)) {
        api.addPanel({
          id: tab.id,
          title: tab.title,
          component: "terminal",
          params: { tabId: tab.id },
        });
        syncedRef.current.add(tab.id);
      }
    }

    for (const id of syncedRef.current) {
      if (!serverIds.has(id)) {
        const panel = api.getPanel(id);
        if (panel) api.removePanel(panel);
        syncedRef.current.delete(id);
      }
    }

    const activePanel = api.getPanel(activeTabId);
    if (activePanel && api.activePanel?.id !== activeTabId) {
      activePanel.api.setActive();
    }

  }, [tabs, activeTabId]);

  // Shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "t") { e.preventDefault(); newTab(); }
      else if (mod && e.key === "w") { e.preventDefault(); if (activeTabId) closeTab(activeTabId); }
      else if (mod && e.shiftKey && e.key === "[") {
        // Cmd+Shift+[ = previous tab
        e.preventDefault();
        const idx = tabs.findIndex((t) => t.id === activeTabId);
        const prev = tabs[(idx - 1 + tabs.length) % tabs.length];
        if (prev) selectTab(prev.id);
      }
      else if (mod && e.shiftKey && e.key === "]") {
        // Cmd+Shift+] = next tab
        e.preventDefault();
        const idx = tabs.findIndex((t) => t.id === activeTabId);
        const next = tabs[(idx + 1) % tabs.length];
        if (next) selectTab(next.id);
      }
    };
    const onNewTabEvent = () => newTab();
    window.addEventListener("keydown", onKey);
    window.addEventListener("terminal:new-tab", onNewTabEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("terminal:new-tab", onNewTabEvent);
    };
  }, [newTab, closeTab, selectTab, activeTabId, tabs]);

  const onReady = useCallback((event: DockviewReadyEvent) => {
    apiRef.current = event.api;

    event.api.onDidActivePanelChange((e) => {
      if (e?.id) selectTab(e.id);
    });

    for (const tab of tabs) {
      event.api.addPanel({
        id: tab.id,
        title: tab.title,
        component: "terminal",
        params: { tabId: tab.id },
      });
      syncedRef.current.add(tab.id);
    }
  }, []);

  return (
    <TerminalRegistryContext.Provider value={registry}>
      <NewTabContext.Provider value={newTab}>
        <div style={{ height: "100vh", width: "100vw" }}>
          <DockviewReact
            className="dockview-theme-dark"
            components={panelComponents}
            onReady={onReady}
            rightHeaderActionsComponent={HeaderActions}
          />
        </div>
      </NewTabContext.Provider>
    </TerminalRegistryContext.Provider>
  );
}

// ── Header + button ──

function HeaderActions(): React.ReactElement {
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent("terminal:new-tab"))}
      style={{ background: "none", border: "none", color: "#888", cursor: "pointer", padding: "4px 8px", display: "flex", alignItems: "center" }}
      title="New Terminal (Ctrl+T)"
    >
      <Plus size={14} />
    </button>
  );
}

// ── Dockview panel: renders the registered Terminal child ──

function DockviewTerminalPanel({ params }: IDockviewPanelProps<{ tabId: string }>): React.ReactElement {
  const registry = useContext(TerminalRegistryContext);
  const child = registry.get(params.tabId);

  if (!child) {
    return <div style={{ padding: 20, color: "#555" }}>Loading...</div>;
  }

  return <>{child}</>;
}

const panelComponents = { terminal: DockviewTerminalPanel };

// ── Terminal (xterm.js) — exported for react-fullstack component mapping ──

export function Terminal(props: InferClientProps<typeof TerminalDef>): React.ReactElement {
  const { output, id } = props;
  const sendInput = props.onInput.mutate;
  const sendResize = props.onResize.mutate;
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'JetBrainsMono Nerd Font Mono', 'CaskaydiaCove Nerd Font', 'FiraCode Nerd Font', monospace",
      theme: { background: "#1e1e1e", foreground: "#d4d4d4", cursor: "#d4d4d4", selectionBackground: "#264f78" },
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(containerRef.current);
    fitAddon.fit();
    xtermRef.current = xterm;
    fitRef.current = fitAddon;

    xterm.onData((data: string) => {
      sendInput(toBase64(new TextEncoder().encode(data)));
    });

    xterm.attachCustomKeyEventHandler((event) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && (event.key === "t" || event.key === "w")) return false;
      if (mod && event.shiftKey && (event.key === "[" || event.key === "]")) return false;
      if (event.key === "Escape") { event.preventDefault(); return true; }
      return true;
    });

    const ro = new ResizeObserver(() => {
      fitAddon.fit();
      sendResize({ cols: xterm.cols, rows: xterm.rows });
    });
    ro.observe(containerRef.current);
    sendResize({ cols: xterm.cols, rows: xterm.rows });

    return () => {
      ro.disconnect();
      xterm.dispose();
      xtermRef.current = null;
      fitRef.current = null;
    };
  }, []);

  useEffect(() => {
    return output.subscribe((b64: string) => {
      xtermRef.current?.write(fromBase64(b64));
    });
  }, [output]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} data-testid={`terminal-${id}`} />;
}
