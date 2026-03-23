import React, { useState, useEffect, useRef } from "react";
import type { InferClientProps } from "@playfast/echoform/client";
import type {
  Dashboard as DashboardDef,
  ProcessTable as ProcessTableDef,
  LogStream as LogStreamDef,
} from "../shared/views";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function Bar({ value, max, color }: { readonly value: number; readonly max: number; readonly color: string }): React.ReactElement {
  const percent = Math.min((value / max) * 100, 100);
  return (
    <div style={{ height: 6, background: "#1a1a1a", borderRadius: 3, overflow: "hidden", flex: 1 }}>
      <div style={{ height: "100%", width: `${percent}%`, background: color, borderRadius: 3, transition: "width 0.3s" }} />
    </div>
  );
}

export function Dashboard({ hostname, platform, uptime, cpuUsage, memoryTotal, memoryUsed, processCount }: InferClientProps<typeof DashboardDef>): React.ReactElement {
  const memoryPercent = Math.round((memoryUsed / memoryTotal) * 100);

  return (
    <div style={{ display: "flex", gap: 12, padding: "16px 20px", background: "#111", borderBottom: "1px solid #222" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: "0.05em" }}>Host</div>
        <div style={{ fontSize: 15, color: "#e0e0e0", marginTop: 2 }}>{hostname}</div>
        <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{platform} &middot; up {formatUptime(uptime)}</div>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#555", width: 32 }}>CPU</span>
          <Bar value={cpuUsage} max={100} color={cpuUsage > 80 ? "#e5534b" : "#4ec944"} />
          <span style={{ fontSize: 12, color: "#aaa", width: 42, textAlign: "right" }}>{cpuUsage}%</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          <span style={{ fontSize: 11, color: "#555", width: 32 }}>MEM</span>
          <Bar value={memoryUsed} max={memoryTotal} color={memoryPercent > 80 ? "#e5534b" : "#4e8cc9"} />
          <span style={{ fontSize: 12, color: "#aaa", width: 42, textAlign: "right" }}>{memoryPercent}%</span>
        </div>
        <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>
          {formatBytes(memoryUsed)} / {formatBytes(memoryTotal)} &middot; {processCount} processes
        </div>
      </div>
    </div>
  );
}

export function ProcessTable({ processes, sortBy, onKill, onSort, onRefresh }: InferClientProps<typeof ProcessTableDef>): React.ReactElement {
  const killProcess = onKill.mutate;
  const sortProcesses = onSort.mutate;
  const refreshProcesses = onRefresh.mutate;

  const columns: ReadonlyArray<{ key: "pid" | "name" | "cpu" | "memory"; label: string; width: string; align: "left" | "right" }> = [
    { key: "pid", label: "PID", width: "70px", align: "right" },
    { key: "name", label: "Name", width: "1fr", align: "left" },
    { key: "cpu", label: "CPU %", width: "80px", align: "right" },
    { key: "memory", label: "Memory", width: "90px", align: "right" },
  ];

  return (
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "8px 20px", borderBottom: "1px solid #222", gap: 8 }}>
        <span style={{ fontSize: 12, color: "#555", flex: 1 }}>Top {processes.length} processes by {sortBy}</span>
        <button onClick={() => refreshProcesses()} style={buttonStyle}>Refresh</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: columns.map((col) => col.width).join(" "), padding: "6px 20px", borderBottom: "1px solid #1a1a1a", fontSize: 11, color: "#555" }}>
        {columns.map((col) => (
          <div
            key={col.key}
            onClick={() => sortProcesses(col.key)}
            style={{ cursor: "pointer", textAlign: col.align, fontWeight: sortBy === col.key ? 600 : 400, color: sortBy === col.key ? "#aaa" : "#555" }}
          >
            {col.label} {sortBy === col.key ? "\u25BC" : ""}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, overflow: "auto" }}>
        {processes.map((proc) => (
          <div
            key={proc.pid}
            style={{ display: "grid", gridTemplateColumns: columns.map((col) => col.width).join(" "), padding: "4px 20px", fontSize: 12, borderBottom: "1px solid #111", alignItems: "center" }}
          >
            <div style={{ textAlign: "right", color: "#555", fontVariantNumeric: "tabular-nums" }}>{proc.pid}</div>
            <div style={{ color: "#ccc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>{proc.name}</div>
            <div style={{ textAlign: "right", color: proc.cpu > 50 ? "#e5534b" : "#aaa", fontVariantNumeric: "tabular-nums" }}>{proc.cpu.toFixed(1)}</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
              <span style={{ color: "#aaa", fontVariantNumeric: "tabular-nums" }}>{formatBytes(proc.memory)}</span>
              <button onClick={() => killProcess(proc.pid)} style={{ ...buttonStyle, color: "#e5534b", fontSize: 10, padding: "1px 6px" }}>kill</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid #333",
  color: "#888",
  borderRadius: 4,
  padding: "3px 10px",
  fontSize: 11,
  cursor: "pointer",
};

export function LogStream({ title, lines }: InferClientProps<typeof LogStreamDef>): React.ReactElement {
  const [logLines, setLogLines] = useState<ReadonlyArray<string>>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return lines.subscribe((line: string) => {
      setLogLines((prev) => [...prev.slice(-100), `${new Date().toLocaleTimeString()} ${line}`]);
    });
  }, [lines]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logLines]);

  return (
    <div style={{ height: 120, borderTop: "1px solid #222", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "6px 20px", fontSize: 11, color: "#555", borderBottom: "1px solid #1a1a1a" }}>{title}</div>
      <div ref={containerRef} style={{ flex: 1, overflow: "auto", padding: "4px 20px", fontSize: 11, fontFamily: "monospace", color: "#666" }}>
        {logLines.map((line, index) => (
          <div key={index}>{line}</div>
        ))}
        {logLines.length === 0 && <div style={{ color: "#333", fontStyle: "italic" }}>No activity yet</div>}
      </div>
    </div>
  );
}
