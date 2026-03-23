import React, { useEffect, useRef, useMemo, useCallback, createContext, useContext, type ReactNode } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { DockviewReact, type DockviewReadyEvent, type IDockviewPanelProps, type DockviewApi } from "dockview-react";
import "dockview-react/dist/styles/dockview.css";
import { Plus, X } from "lucide-react";
import type { InferClientProps } from "@react-fullstack/fullstack/client";
import type {
  TerminalApp as TerminalAppDef,
  Workspace as WorkspaceDef,
  Terminal as TerminalDef,
} from "../shared/views";

// ── Base64 helpers ──

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

// ── Contexts ──

type TerminalRegistry = ReadonlyMap<string, ReactNode>;
const TerminalRegistryContext = createContext<TerminalRegistry>(new Map());

// ── TerminalApp ──

export function TerminalApp(props: InferClientProps<typeof TerminalAppDef>): React.ReactElement {
  const { workspaces, activeWorkspaceId, children } = props;
  const newWorkspace = props.onNewWorkspace.mutate;
  const selectWorkspace = props.onSelectWorkspace.mutate;
  const closeWorkspace = props.onCloseWorkspace.mutate;

  // Shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.shiftKey && (e.key === "N" || e.key === "n")) {
        e.preventDefault();
        newWorkspace();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newWorkspace]);

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw", background: "#0e0e0e" }}>
      {/* Sidebar */}
      <div style={{
        width: 48, minWidth: 48,
        background: "#111",
        borderRight: "1px solid #222",
        display: "flex", flexDirection: "column",
        paddingTop: 8,
      }}>
        {workspaces.map((ws, i) => (
          <SidebarItem
            key={ws.id}
            label={String(i + 1)}
            active={ws.id === activeWorkspaceId}
            onClick={() => selectWorkspace(ws.id)}
            onClose={workspaces.length > 1 ? () => closeWorkspace(ws.id) : undefined}
          />
        ))}
        <SidebarButton onClick={newWorkspace} title="New Workspace (⌘⇧N)" />
      </div>

      {/* Workspace area — all mounted, only active visible */}
      <div style={{ flex: 1, position: "relative" }}>
        {React.Children.map(children, (child) => {
          const el = child as React.ReactElement;
          const wsId = (el.props as { id?: string }).id;
          return (
            <div style={{
              position: "absolute", inset: 0,
              display: wsId === activeWorkspaceId ? "flex" : "none",
            }}>
              {child}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Sidebar pieces ──

function SidebarItem({ label, active, onClick, onClose }: {
  readonly label: string;
  readonly active: boolean;
  readonly onClick: () => void;
  readonly onClose?: () => void;
}): React.ReactElement {
  return (
    <div
      onClick={onClick}
      style={{
        width: 34, height: 34,
        margin: "2px auto",
        borderRadius: 8,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 500, fontFamily: "system-ui, sans-serif",
        color: active ? "#e0e0e0" : "#555",
        background: active ? "#262626" : "transparent",
        cursor: "pointer",
        position: "relative",
        transition: "background 0.15s, color 0.15s",
      }}
      title={`Workspace ${label}`}
    >
      {label}
      {onClose && (
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          style={{
            position: "absolute", top: -2, right: -2,
            width: 14, height: 14, borderRadius: 7,
            background: "#333", border: "none",
            color: "#888", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 0, fontSize: 0,
            opacity: 0,
            transition: "opacity 0.15s",
          }}
          className="ws-close"
        >
          <X size={8} />
        </button>
      )}
      <style>{`.ws-close { opacity: 0 !important; } div:hover > .ws-close { opacity: 1 !important; }`}</style>
    </div>
  );
}

function SidebarButton({ onClick, title }: {
  readonly onClick: () => void;
  readonly title: string;
}): React.ReactElement {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 34, height: 34,
        margin: "4px auto 0",
        borderRadius: 8,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "none", border: "1px solid #2a2a2a",
        color: "#555", cursor: "pointer",
        transition: "color 0.15s, border-color 0.15s",
      }}
    >
      <Plus size={14} />
    </button>
  );
}

// ── Workspace ──

export function Workspace(props: InferClientProps<typeof WorkspaceDef>): React.ReactElement {
  const { tabs, activeTabId, children } = props;
  const newTab = props.onNewTab.mutate;
  const closeTab = props.onCloseTab.mutate;
  const selectTab = props.onSelectTab.mutate;

  const apiRef = useRef<DockviewApi | null>(null);
  const syncedRef = useRef<Set<string>>(new Set());

  const registry = useMemo(() => {
    const map = new Map<string, ReactNode>();
    const childArray = React.Children.toArray(children) as React.ReactElement[];
    for (const child of childArray) {
      const id = (child.props as { id?: string }).id;
      if (id) map.set(id, child);
    }
    return map;
  }, [children]);

  // Sync server tabs → dockview panels
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;

    const serverIds = new Set(tabs.map((t) => t.id));

    for (const tab of tabs) {
      if (!syncedRef.current.has(tab.id)) {
        api.addPanel({ id: tab.id, title: tab.title, component: "terminal", params: { tabId: tab.id } });
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
      if (mod && !e.shiftKey && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        newTab();
      } else if (mod && e.key === "w") {
        e.preventDefault();
        if (activeTabId) closeTab(activeTabId);
      } else if (mod && e.shiftKey && e.key === "[") {
        e.preventDefault();
        const idx = tabs.findIndex((t) => t.id === activeTabId);
        const prev = tabs[(idx - 1 + tabs.length) % tabs.length];
        if (prev) selectTab(prev.id);
      } else if (mod && e.shiftKey && e.key === "]") {
        e.preventDefault();
        const idx = tabs.findIndex((t) => t.id === activeTabId);
        const next = tabs[(idx + 1) % tabs.length];
        if (next) selectTab(next.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newTab, closeTab, selectTab, activeTabId, tabs]);

  const onReady = useCallback((event: DockviewReadyEvent) => {
    apiRef.current = event.api;
    event.api.onDidActivePanelChange((e) => { if (e?.id) selectTab(e.id); });
    for (const tab of tabs) {
      event.api.addPanel({ id: tab.id, title: tab.title, component: "terminal", params: { tabId: tab.id } });
      syncedRef.current.add(tab.id);
    }
  }, []);

  return (
    <TerminalRegistryContext.Provider value={registry}>
      <DockviewReact
        className="dockview-theme-dark"
        components={panelComponents}
        onReady={onReady}
        rightHeaderActionsComponent={TabHeaderActions}
      />
    </TerminalRegistryContext.Provider>
  );
}

function TabHeaderActions(): React.ReactElement {
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent("terminal:new-tab"))}
      style={{
        background: "none", border: "none",
        color: "#666", cursor: "pointer",
        padding: "4px 8px",
        display: "flex", alignItems: "center",
      }}
      title="New Tab (⌘N)"
    >
      <Plus size={14} />
    </button>
  );
}

// ── Dockview panel ──

function DockviewTerminalPanel({ params }: IDockviewPanelProps<{ tabId: string }>): React.ReactElement {
  const registry = useContext(TerminalRegistryContext);
  const child = registry.get(params.tabId);
  if (!child) return <div style={{ padding: 20, color: "#444" }}>Loading…</div>;
  return <>{child}</>;
}

const panelComponents = { terminal: DockviewTerminalPanel };

// ── Terminal ──

export function Terminal(props: InferClientProps<typeof TerminalDef>): React.ReactElement {
  const { output, id } = props;
  const sendInput = props.onInput.mutate;
  const sendResize = props.onResize.mutate;
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'JetBrainsMono Nerd Font Mono', 'CaskaydiaCove Nerd Font', 'FiraCode Nerd Font', monospace",
      theme: { background: "#0e0e0e", foreground: "#d4d4d4", cursor: "#d4d4d4", selectionBackground: "#264f78" },
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(containerRef.current);
    fitAddon.fit();
    xtermRef.current = xterm;

    xterm.onData((data: string) => sendInput(toBase64(new TextEncoder().encode(data))));

    xterm.attachCustomKeyEventHandler((event) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && (event.key === "n" || event.key === "N" || event.key === "w")) return false;
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
    };
  }, []);

  useEffect(() => {
    return output.subscribe((b64: string) => {
      xtermRef.current?.write(fromBase64(b64));
    });
  }, [output]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} data-testid={`terminal-${id}`} />;
}
