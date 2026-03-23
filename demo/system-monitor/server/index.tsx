// systeminformation shells out to sysctl/vm_stat on macOS without full paths
if (process.env.PATH && !process.env.PATH.includes("/usr/sbin")) {
  process.env.PATH = `/usr/sbin:/sbin:${process.env.PATH}`;
}

import React, { useState, useCallback, useEffect, useRef } from "react";
import * as os from "os";
import si from "systeminformation";
import { Render } from "@playfast/echoform-render";
import { Server, useViews, useStream } from "@playfast/echoform/server";
import { createBunWebSocketServer } from "@playfast/echoform-bun-ws-server";
import { views, LogStream } from "../shared/views";

type SortField = "cpu" | "memory" | "name" | "pid";

interface ProcessSnapshot {
  readonly pid: number;
  readonly name: string;
  readonly cpu: number;
  readonly memory: number;
}

async function getSystemSnapshot(): Promise<{
  readonly cpuUsage: number;
  readonly memoryTotal: number;
  readonly memoryUsed: number;
  readonly processes: ReadonlyArray<ProcessSnapshot>;
}> {
  const [cpu, mem, procs] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.processes(),
  ]);

  return {
    cpuUsage: Math.round(cpu.currentLoad * 10) / 10,
    memoryTotal: mem.total,
    memoryUsed: mem.used,
    processes: procs.list.map((proc) => ({
      pid: proc.pid,
      name: proc.name,
      cpu: Math.round(proc.cpu * 10) / 10,
      memory: proc.memRss,
    })),
  };
}

function sortProcesses(
  processes: ReadonlyArray<ProcessSnapshot>,
  sortBy: SortField,
): ReadonlyArray<ProcessSnapshot> {
  return [...processes].sort((a, b) => {
    if (sortBy === "cpu") return b.cpu - a.cpu;
    if (sortBy === "memory") return b.memory - a.memory;
    if (sortBy === "name") return a.name.localeCompare(b.name);
    return a.pid - b.pid;
  });
}

function MonitorApp(): React.ReactElement | null {
  const View = useViews(views);
  const logLines = useStream(LogStream, "lines");

  const [processes, setProcesses] = useState<ReadonlyArray<ProcessSnapshot>>([]);
  const [sortBy, setSortBy] = useState<SortField>("cpu");
  const [cpuUsage, setCpuUsage] = useState(0);
  const [memoryTotal, setMemoryTotal] = useState(os.totalmem());
  const [memoryUsed, setMemoryUsed] = useState(os.totalmem() - os.freemem());
  const logRef = useRef(logLines);
  logRef.current = logLines;

  const refresh = useCallback(async () => {
    const snapshot = await getSystemSnapshot();
    setProcesses(snapshot.processes);
    setCpuUsage(snapshot.cpuUsage);
    setMemoryTotal(snapshot.memoryTotal);
    setMemoryUsed(snapshot.memoryUsed);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleKill = useCallback((pid: number) => {
    try {
      process.kill(pid, "SIGTERM");
      logRef.current.emit(`Sent SIGTERM to PID ${pid}`);
    } catch {
      logRef.current.emit(`Failed to kill PID ${pid}`);
    }
  }, []);

  if (!View) return null;

  const sorted = sortProcesses(processes, sortBy);
  const topProcesses = sorted.slice(0, 50);

  return (
    <>
      <View.Dashboard
        hostname={os.hostname()}
        platform={`${os.type()} ${os.arch()}`}
        uptime={os.uptime()}
        cpuUsage={cpuUsage}
        memoryTotal={memoryTotal}
        memoryUsed={memoryUsed}
        processCount={processes.length}
      />
      <View.ProcessTable
        processes={topProcesses}
        sortBy={sortBy}
        onKill={handleKill}
        onSort={setSortBy}
        onRefresh={refresh}
      />
      <View.LogStream title="Activity Log" lines={logLines} />
    </>
  );
}

const PORT = parseInt(process.env.PORT ?? "4231", 10);

const { transport, start } = createBunWebSocketServer({
  port: PORT,
  path: "/ws",
});

const server = start();

console.log(`System Monitor running on ws://localhost:${PORT}/ws`);

process.on("SIGINT", () => { server.stop(); process.exit(0); });
process.on("SIGTERM", () => { server.stop(); process.exit(0); });

Render(
  <Server transport={transport} singleInstance>
    {() => <MonitorApp />}
  </Server>,
);
