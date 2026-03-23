import React, { useEffect, useRef, useMemo, useCallback, createContext, useContext, type ReactNode } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { DockviewReact, type DockviewReadyEvent, type IDockviewPanelProps, type DockviewApi } from "dockview-react";
import "dockview-react/dist/styles/dockview.css";
import { Play, Square, RotateCw } from "lucide-react";
import type { InferClientProps } from "@play/echoform/client";
import type {
  DevServerApp as DevServerAppDef,
  ProcessTerminal as ProcessTerminalDef,
} from "../shared/views";

// ── Base64 ──

function toBase64(data: Uint8Array): string {
  let binaryString = "";
  for (let i = 0; i < data.length; i++) binaryString += String.fromCharCode(data[i]!);
  return btoa(binaryString);
}

function fromBase64(b64: string): Uint8Array {
  const decoded = atob(b64);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
  return bytes;
}

// ── Contexts ──

type TerminalRegistry = ReadonlyMap<string, ReactNode>;
const TerminalRegistryContext = createContext<TerminalRegistry>(new Map());

interface ProcessActions {
  readonly activeStatus: string;
  readonly start: () => void;
  readonly stop: () => void;
  readonly restart: () => void;
}
const ProcessActionsContext = createContext<ProcessActions | null>(null);

// ── Status ──

const STATUS_COLORS: Record<string, string> = {
  running: "#4ec944",
  idle: "#555",
  stopped: "#888",
  failed: "#e5534b",
};

// ── DevServerApp ──

export function DevServerApp(props: InferClientProps<typeof DevServerAppDef>): React.ReactElement {
  const { processes, activeProcessId, children } = props;
  const selectProcess = props.onSelectProcess.mutate;
  const startProcess = props.onStartProcess.mutate;
  const stopProcess = props.onStopProcess.mutate;
  const restartProcess = props.onRestartProcess.mutate;

  const apiRef = useRef<DockviewApi | null>(null);
  const syncedRef = useRef<Set<string>>(new Set());

  const registry = useMemo(() => {
    const map = new Map<string, ReactNode>();
    for (const child of React.Children.toArray(children) as React.ReactElement[]) {
      const id = (child.props as { id?: string }).id;
      if (id) map.set(id, child);
    }
    return map;
  }, [children]);

  // Sync new panels added after initial mount
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;

    for (const proc of processes) {
      if (!syncedRef.current.has(proc.id)) {
        api.addPanel({ id: proc.id, title: proc.name, component: "process", params: { procId: proc.id } });
        syncedRef.current.add(proc.id);
      }
    }

    const activePanel = api.getPanel(activeProcessId);
    if (activePanel && api.activePanel?.id !== activeProcessId) {
      activePanel.api.setActive();
    }
  }, [processes, activeProcessId]);

  // Keyboard: Cmd+1–9
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key >= "1" && e.key <= "9") {
        const idx = parseInt(e.key, 10) - 1;
        if (idx < processes.length) {
          e.preventDefault();
          selectProcess(processes[idx]!.id);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectProcess, processes]);

  const onReady = useCallback((event: DockviewReadyEvent) => {
    apiRef.current = event.api;
    event.api.onDidActivePanelChange((e) => { if (e?.id) selectProcess(e.id); });
    for (const proc of processes) {
      event.api.addPanel({ id: proc.id, title: proc.name, component: "process", params: { procId: proc.id } });
      syncedRef.current.add(proc.id);
    }
  }, []);

  const activeProc = processes.find((p) => p.id === activeProcessId);
  const activeStatus = activeProc?.status ?? "idle";

  const actions = useMemo<ProcessActions>(() => ({
    activeStatus,
    start: () => startProcess(activeProcessId),
    stop: () => stopProcess(activeProcessId),
    restart: () => restartProcess(activeProcessId),
  }), [activeStatus, activeProcessId, startProcess, stopProcess, restartProcess]);

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw", background: "#0e0e0e", color: "#d4d4d4", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Sidebar */}
      <div style={{ width: 192, minWidth: 192, background: "#111", borderRight: "1px solid #1e1e1e", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "12px 14px 6px", fontSize: 11, fontWeight: 600, color: "#4a4a4a", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Processes
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {processes.map((proc, i) => {
            const active = proc.id === activeProcessId;
            return (
              <button
                key={proc.id}
                onClick={() => selectProcess(proc.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  width: "100%", padding: "7px 14px",
                  background: active ? "#1a1a1a" : "transparent",
                  border: "none",
                  borderLeft: active ? "2px solid #4ec944" : "2px solid transparent",
                  color: active ? "#e0e0e0" : "#777",
                  cursor: "pointer", fontSize: 13,
                  textAlign: "left",
                }}
              >
                <span style={{
                  width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                  background: STATUS_COLORS[proc.status] ?? "#555",
                }} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {proc.name}
                </span>
                {i < 9 && (
                  <span style={{ fontSize: 10, color: "#333", fontVariantNumeric: "tabular-nums" }}>
                    ⌘{i + 1}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Terminal area */}
      <div style={{ flex: 1, position: "relative" }}>
        <ProcessActionsContext.Provider value={actions}>
          <TerminalRegistryContext.Provider value={registry}>
            <DockviewReact
              className="dockview-theme-dark"
              components={panelComponents}
              onReady={onReady}
              rightHeaderActionsComponent={HeaderActions}
            />
          </TerminalRegistryContext.Provider>
        </ProcessActionsContext.Provider>
      </div>
    </div>
  );
}

// ── Tab bar actions ──

function HeaderActions(): React.ReactElement {
  const actions = useContext(ProcessActionsContext);
  if (!actions) return <></>;
  const { activeStatus, start, stop, restart } = actions;
  const running = activeStatus === "running";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "0 8px", marginLeft: 4, borderLeft: "1px solid #2a2a2a", height: "100%" }}>
      <IconButton icon={<Play size={12} />} title="Start" disabled={running} onClick={start} />
      <IconButton icon={<RotateCw size={11} />} title="Restart" disabled={!running} onClick={restart} />
      <IconButton icon={<Square size={10} />} title="Stop" disabled={!running} onClick={stop} />
    </div>
  );
}

function IconButton({ icon, title, disabled, onClick }: {
  readonly icon: ReactNode;
  readonly title: string;
  readonly disabled: boolean;
  readonly onClick: () => void;
}): React.ReactElement {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 24, height: 24,
        borderRadius: 4,
        border: "1px solid transparent",
        background: "none",
        color: disabled ? "#333" : "#999",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1,
        padding: 0,
      }}
    >
      {icon}
    </button>
  );
}

// ── Dockview panel ──

function DockviewProcessPanel({ params }: IDockviewPanelProps<{ procId: string }>): React.ReactElement {
  const registry = useContext(TerminalRegistryContext);
  const child = registry.get(params.procId);
  if (!child) return <div style={{ padding: 20, color: "#444" }}>Loading…</div>;
  return <>{child}</>;
}

const panelComponents = { process: DockviewProcessPanel };

// ── ProcessTerminal ──

export function ProcessTerminal(props: InferClientProps<typeof ProcessTerminalDef>): React.ReactElement {
  const { output, id, status } = props;
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
      if ((event.metaKey || event.ctrlKey) && event.key >= "1" && event.key <= "9") return false;
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

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} data-testid={`terminal-${id}`} />
      {status !== "running" && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0,
          padding: "4px 12px",
          background: status === "failed" ? "rgba(229,83,75,0.12)" : "rgba(255,255,255,0.04)",
          color: status === "failed" ? "#e5534b" : "#555",
          fontSize: 12, fontFamily: "system-ui, sans-serif",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}>
          {status === "idle" && "Process not started"}
          {status === "stopped" && "Process exited"}
          {status === "failed" && "Process failed"}
        </div>
      )}
    </div>
  );
}
