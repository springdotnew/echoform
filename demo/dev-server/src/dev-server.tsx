import React, { useState, useEffect, useRef } from "react";
import { Render } from "@playfast/echoform-render";
import { Server, useViews, useStream } from "@playfast/echoform/server";
import { createBunWebSocketServer } from "@playfast/echoform-bun-ws-server";
import { views, ProcessTerminal } from "../shared/views";
import { createManagedProcess, type ManagedProcess } from "./process";
import type { DevServerConfig, ProcessStatus } from "./types";

function ProcessTerminalSession({ proc }: { readonly proc: ManagedProcess }): React.ReactElement | null {
  const View = useViews(views);
  const output = useStream(ProcessTerminal, "output");

  useEffect(() => {
    proc.attachOutput(output);
    if (proc.config.autoStart !== false) {
      proc.start();
    }
    return () => proc.dispose();
  }, []);

  if (!View) return null;

  return (
    <View.ProcessTerminal
      id={proc.id}
      name={proc.name}
      status={proc.status}
      output={output}
      onInput={(b64) => proc.write(b64)}
      onResize={({ cols, rows }) => proc.resize(cols, rows)}
    />
  );
}

function DevServerRoot({ processes }: { readonly processes: ReadonlyMap<string, ManagedProcess> }): React.ReactElement | null {
  const View = useViews(views);
  const keys = [...processes.keys()];
  const [activeId, setActiveId] = useState(keys[0] ?? "");
  const [statuses, setStatuses] = useState<Record<string, ProcessStatus>>(() =>
    Object.fromEntries(keys.map((k) => [k, "idle"])),
  );

  const statusRef = useRef(statuses);
  useEffect(() => {
    const interval = setInterval(() => {
      let changed = false;
      const next: Record<string, ProcessStatus> = {};
      for (const [id, proc] of processes) {
        next[id] = proc.status;
        if (proc.status !== statusRef.current[id]) changed = true;
      }
      if (changed) {
        statusRef.current = next;
        setStatuses(next);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [processes]);

  if (!View) return null;

  const processList = keys.map((id) => ({
    id,
    name: processes.get(id)!.name,
    status: statuses[id] ?? ("idle" as const),
  }));

  return (
    <View.DevServerApp
      processes={processList}
      activeProcessId={activeId}
      onSelectProcess={setActiveId}
      onStartProcess={(id) => processes.get(id)?.start()}
      onStopProcess={(id) => processes.get(id)?.stop()}
      onRestartProcess={(id) => processes.get(id)?.restart()}
    >
      {keys.map((id) => (
        <ProcessTerminalSession key={id} proc={processes.get(id)!} />
      ))}
    </View.DevServerApp>
  );
}

export interface DevServerHandle {
  readonly stop: () => void;
}

export async function devServer(config: DevServerConfig): Promise<DevServerHandle> {
  const port = config.port ?? 4220;

  const processes = new Map<string, ManagedProcess>();
  for (const [name, procConfig] of Object.entries(config.procs)) {
    processes.set(name, createManagedProcess(name, name, procConfig, () => {}));
  }

  const { transport, start } = createBunWebSocketServer({ port, path: "/ws" });
  const server = start();

  console.log(`Dev server running on ws://localhost:${port}/ws`);

  Render(
    <Server transport={transport}>
      {() => <DevServerRoot processes={processes} />}
    </Server>,
  );

  const stop = (): void => {
    for (const proc of processes.values()) proc.dispose();
    server.stop();
  };

  process.on("SIGINT", () => { stop(); process.exit(0); });
  process.on("SIGTERM", () => { stop(); process.exit(0); });

  return { stop };
}
