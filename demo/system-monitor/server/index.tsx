import React, { useState, useCallback, useEffect, useRef } from "react";
import * as os from "os";
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

function getSystemStats(): { cpuUsage: number; memoryTotal: number; memoryUsed: number } {
  const cpus = os.cpus();
  const cpuUsage = cpus.reduce((sum, cpu) => {
    const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
    return sum + (1 - cpu.times.idle / total);
  }, 0) / cpus.length;

  const memoryTotal = os.totalmem();
  const memoryUsed = memoryTotal - os.freemem();
  return { cpuUsage: Math.round(cpuUsage * 1000) / 10, memoryTotal, memoryUsed };
}

function parseProcessLine(line: string): ProcessSnapshot | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s+/);
  if (parts.length < 4) return null;
  const pid = parseInt(parts[0]!, 10);
  const cpu = parseFloat(parts[1]!);
  const memory = parseInt(parts[2]!, 10) * 1024;
  const name = parts.slice(3).join(" ");
  if (isNaN(pid) || isNaN(cpu)) return null;
  return { pid, name, cpu, memory };
}

async function getProcessList(): Promise<ReadonlyArray<ProcessSnapshot>> {
  const isDarwin = os.platform() === "darwin";
  const args = isDarwin
    ? ["ps", "-axo", "pid,pcpu,rss,comm"]
    : ["ps", "-eo", "pid,pcpu,rss,comm", "--no-headers"];

  const result = Bun.spawnSync(args);
  const lines = result.stdout.toString().split("\n");
  const startIndex = isDarwin ? 1 : 0;
  const processes: ProcessSnapshot[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const snapshot = parseProcessLine(lines[i]!);
    if (snapshot) processes.push(snapshot);
  }

  return processes;
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
  const [stats, setStats] = useState(getSystemStats);
  const logRef = useRef(logLines);
  logRef.current = logLines;

  const refresh = useCallback(async () => {
    const processList = await getProcessList();
    setProcesses(processList);
    setStats(getSystemStats());
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

  const handleSort = useCallback((field: SortField) => {
    setSortBy(field);
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
        cpuUsage={stats.cpuUsage}
        memoryTotal={stats.memoryTotal}
        memoryUsed={stats.memoryUsed}
        processCount={processes.length}
      />
      <View.ProcessTable
        processes={topProcesses}
        sortBy={sortBy}
        onKill={handleKill}
        onSort={handleSort}
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
