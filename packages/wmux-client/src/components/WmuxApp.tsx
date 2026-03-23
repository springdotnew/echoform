import React, { useEffect, useRef, useMemo, useCallback, useState, createContext, useContext, type ReactNode } from "react";
import { DockviewReact, type DockviewReadyEvent, type IDockviewPanelProps, type DockviewApi } from "dockview-react";
import "dockview-react/dist/styles/dockview.css";
import type { InferClientProps } from "@playfast/echoform/client";
import type { WmuxApp as WmuxAppDef } from "@playfast/wmux/views";
import { STATUS_COLORS, THEME } from "../styles/theme";
import { HeaderActions } from "./HeaderActions";
import { applyLayout, reapplyLayout, saveLayout, loadSavedLayout, type LayoutPreset, type LayoutConfig } from "./layout";

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

export interface LayoutActions {
  readonly currentPreset: LayoutPreset | null;
  readonly applyPreset: (preset: LayoutPreset) => void;
}
export const LayoutActionsContext = createContext<LayoutActions | null>(null);

// ── Keyboard shortcuts ──

function handleProcessShortcut(
  event: KeyboardEvent,
  processes: ReadonlyArray<{ readonly id: string }>,
  selectProcess: (id: string) => void,
): void {
  if (!(event.metaKey || event.ctrlKey)) return;
  if (event.key < "1" || event.key > "9") return;
  const shortcutIndex = parseInt(event.key, 10) - 1;
  if (shortcutIndex >= processes.length) return;
  event.preventDefault();
  selectProcess(processes[shortcutIndex]!.id);
}

// ── Dockview panel ──

function DockviewProcessPanel({ params }: IDockviewPanelProps<{ procId: string }>): React.ReactElement {
  const registry = useContext(TerminalRegistryContext);
  const child = registry.get(params.procId);
  if (!child) return <div style={{ padding: 20, color: "#444" }}>Loading...</div>;
  return <>{child}</>;
}

const panelComponents = { process: DockviewProcessPanel };

// ── Main component ──

export function WmuxApp(props: InferClientProps<typeof WmuxAppDef>): React.ReactElement {
  const { processes, activeProcessId, layout, children } = props;
  const selectProcess = props.onSelectProcess.mutate;
  const startProcess = props.onStartProcess.mutate;
  const stopProcess = props.onStopProcess.mutate;
  const restartProcess = props.onRestartProcess.mutate;

  const apiRef = useRef<DockviewApi | null>(null);
  const syncedRef = useRef<Set<string>>(new Set());
  const [currentPreset, setCurrentPreset] = useState<LayoutPreset | null>(
    (layout as LayoutConfig | undefined)?.preset ?? null,
  );

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

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => handleProcessShortcut(event, processes, selectProcess);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectProcess, processes]);

  const onReady = useCallback((event: DockviewReadyEvent) => {
    apiRef.current = event.api;
    event.api.onDidActivePanelChange((e) => { if (e?.id) selectProcess(e.id); });

    const processIds = processes.map((p) => p.id);

    // Try to restore saved layout first
    const restored = loadSavedLayout(event.api, processIds);
    if (restored) {
      for (const proc of processes) syncedRef.current.add(proc.id);
      return;
    }

    // Apply server-provided layout or default
    applyLayout(event.api, processes, layout as LayoutConfig | undefined);
    for (const proc of processes) syncedRef.current.add(proc.id);

    // Persist layout changes
    event.api.onDidLayoutChange(() => {
      saveLayout(event.api, processIds);
    });
  }, []);

  const activeProc = processes.find((p) => p.id === activeProcessId);
  const activeStatus = activeProc?.status ?? "idle";

  const processActions = useMemo<ProcessActions>(() => ({
    activeStatus,
    start: () => startProcess(activeProcessId),
    stop: () => stopProcess(activeProcessId),
    restart: () => restartProcess(activeProcessId),
  }), [activeStatus, activeProcessId, startProcess, stopProcess, restartProcess]);

  const layoutActions = useMemo<LayoutActions>(() => ({
    currentPreset,
    applyPreset(preset: LayoutPreset) {
      const api = apiRef.current;
      if (!api) return;
      reapplyLayout(api, processes, preset);
      setCurrentPreset(preset);
      for (const proc of processes) syncedRef.current.add(proc.id);
      saveLayout(api, processes.map((p) => p.id));
    },
  }), [currentPreset, processes]);

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw", background: THEME.bg, color: THEME.text, fontFamily: THEME.fontFamily }}>
      {/* Sidebar */}
      <div style={{ width: 192, minWidth: 192, background: THEME.bgSidebar, borderRight: `1px solid ${THEME.border}`, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "12px 14px 6px", fontSize: 11, fontWeight: 600, color: THEME.textDim, textTransform: "uppercase", letterSpacing: "0.06em" }}>
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
                  background: active ? THEME.bgActive : "transparent",
                  border: "none",
                  borderLeft: active ? `2px solid ${THEME.accent}` : "2px solid transparent",
                  color: active ? THEME.textActive : THEME.textMuted,
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
                  <span style={{ fontSize: 10, color: THEME.textDimmer, fontVariantNumeric: "tabular-nums" }}>
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
        <ProcessActionsContext.Provider value={processActions}>
          <LayoutActionsContext.Provider value={layoutActions}>
            <TerminalRegistryContext.Provider value={registry}>
              <DockviewReact
                className="dockview-theme-dark"
                components={panelComponents}
                onReady={onReady}
                rightHeaderActionsComponent={HeaderActions}
              />
            </TerminalRegistryContext.Provider>
          </LayoutActionsContext.Provider>
        </ProcessActionsContext.Provider>
      </div>
    </div>
  );
}
