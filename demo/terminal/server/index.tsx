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
        data(_t, data: Uint8Array) {
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

function App(): React.ReactElement | null {
  const View = useViews(views);
  const [tabs, setTabs] = useState<readonly Tab[]>([
    { id: String(nextId++), title: "bash" },
  ]);
  const [activeId, setActiveId] = useState(tabs[0]!.id);

  const addTab = useCallback(() => {
    const id = String(nextId++);
    setTabs((prev) => [...prev, { id, title: "bash" }]);
    setActiveId(id);
  }, []);

  const closeTab = useCallback((id: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (next.length === 0) {
        const newId = String(nextId++);
        setActiveId(newId);
        return [{ id: newId, title: "bash" }];
      }
      return next;
    });
    setActiveId((current) => {
      if (current !== id) return current;
      const remaining = tabs.filter((t) => t.id !== id);
      return remaining[0]?.id ?? "";
    });
  }, [tabs]);

  if (!View) return null;

  return (
    <View.TerminalApp
      tabs={tabs as Tab[]}
      activeTabId={activeId}
      onNewTab={addTab}
      onCloseTab={closeTab}
      onSelectTab={setActiveId}
    >
      {tabs.map((tab) => (
        <TerminalSession key={tab.id} tab={tab} />
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
