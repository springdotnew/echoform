import React, { useState, useCallback, useEffect, useRef } from "react";
import { Render } from "@react-fullstack/render";
import { Server, useViews, useStream } from "@react-fullstack/fullstack/server";
import { createBunWebSocketServer } from "@react-fullstack/fullstack-bun-ws-server";
import { views, Terminal } from "../shared/views";

function toBase64(data: Uint8Array): string {
  return Buffer.from(data).toString("base64");
}

function fromBase64(data: string): Uint8Array {
  return Buffer.from(data, "base64");
}

let nextId = 1;

interface Tab {
  readonly id: string;
  readonly title: string;
}

function TerminalSession({ tab }: { readonly tab: Tab }): React.ReactElement | null {
  const View = useViews(views);
  const output = useStream(Terminal, "output");
  const termRef = useRef<{ write: (d: string | Uint8Array) => void; resize: (c: number, r: number) => void; close: () => void } | null>(null);

  useEffect(() => {
    const shell = process.env.SHELL ?? "/bin/bash";
    const proc = Bun.spawn([shell], {
      terminal: {
        cols: 80,
        rows: 24,
        data(_t: unknown, data: Uint8Array) {
          output.emit(toBase64(data));
        },
      },
    });
    termRef.current = proc.terminal!;
    return () => {
      termRef.current?.close();
      termRef.current = null;
    };
  }, [output]);

  if (!View) return null;

  return (
    <View.Terminal
      id={tab.id}
      title={tab.title}
      output={output}
      onInput={(b64) => termRef.current?.write(fromBase64(b64))}
      onResize={({ cols, rows }) => termRef.current?.resize(cols, rows)}
    />
  );
}

function WorkspaceView({ id, onEmpty }: { readonly id: string; readonly onEmpty: () => void }): React.ReactElement | null {
  const View = useViews(views);
  const [tabs, setTabs] = useState<readonly Tab[]>([
    { id: String(nextId++), title: "bash" },
  ]);
  const [activeTabId, setActiveTabId] = useState(tabs[0]!.id);

  const addTab = useCallback(() => {
    const tabId = String(nextId++);
    setTabs((prev) => [...prev, { id: tabId, title: "bash" }]);
    setActiveTabId(tabId);
  }, []);

  const closeTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== tabId);
      if (next.length === 0) {
        onEmpty();
        return prev;
      }
      return next;
    });
    setActiveTabId((current) => {
      if (current !== tabId) return current;
      const remaining = tabs.filter((t) => t.id !== tabId);
      return remaining[0]?.id ?? "";
    });
  }, [tabs, onEmpty]);

  if (!View) return null;

  return (
    <View.Workspace
      id={id}
      tabs={tabs as Tab[]}
      activeTabId={activeTabId}
      onNewTab={addTab}
      onCloseTab={closeTab}
      onSelectTab={setActiveTabId}
    >
      {tabs.map((tab) => (
        <TerminalSession key={tab.id} tab={tab} />
      ))}
    </View.Workspace>
  );
}

interface WorkspaceInfo {
  readonly id: string;
  readonly name: string;
}

function App(): React.ReactElement | null {
  const View = useViews(views);
  const [workspaces, setWorkspaces] = useState<readonly WorkspaceInfo[]>([
    { id: String(nextId++), name: "Workspace 1" },
  ]);
  const [activeId, setActiveId] = useState(workspaces[0]!.id);
  const wsCountRef = useRef(1);

  const addWorkspace = useCallback(() => {
    wsCountRef.current += 1;
    const wsId = String(nextId++);
    setWorkspaces((prev) => [...prev, { id: wsId, name: `Workspace ${wsCountRef.current}` }]);
    setActiveId(wsId);
  }, []);

  const closeWorkspace = useCallback((wsId: string) => {
    setWorkspaces((prev) => {
      const next = prev.filter((w) => w.id !== wsId);
      if (next.length === 0) {
        wsCountRef.current += 1;
        const newId = String(nextId++);
        setActiveId(newId);
        return [{ id: newId, name: `Workspace ${wsCountRef.current}` }];
      }
      return next;
    });
    setActiveId((current) => {
      if (current !== wsId) return current;
      const remaining = workspaces.filter((w) => w.id !== wsId);
      return remaining[0]?.id ?? "";
    });
  }, [workspaces]);

  if (!View) return null;

  return (
    <View.TerminalApp
      workspaces={workspaces as WorkspaceInfo[]}
      activeWorkspaceId={activeId}
      onNewWorkspace={addWorkspace}
      onSelectWorkspace={setActiveId}
      onCloseWorkspace={closeWorkspace}
    >
      {workspaces.map((ws) => (
        <WorkspaceView key={ws.id} id={ws.id} onEmpty={() => closeWorkspace(ws.id)} />
      ))}
    </View.TerminalApp>
  );
}

const PORT = parseInt(process.env.PORT ?? "4220", 10);
const { transport, start } = createBunWebSocketServer({ port: PORT, path: "/ws" });
const server = start();

console.log(`Terminal server running on ws://localhost:${PORT}/ws`);

process.on("SIGINT", () => { server.stop(); process.exit(0); });
process.on("SIGTERM", () => { server.stop(); process.exit(0); });

Render(
  <Server transport={transport}>
    {() => <App />}
  </Server>
);
