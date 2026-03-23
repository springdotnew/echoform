import React, { useState, useEffect, useRef } from "react";
import type { InferClientProps } from "@playfast/echoform/client";
import type {
  Dashboard as DashboardDef,
  ProcessTable as ProcessTableDef,
  LogStream as LogStreamDef,
} from "../shared/views";

// ── Formatting ──

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
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function cpuColor(percent: number): string {
  if (percent > 50) return "#f85149";
  if (percent > 10) return "#d29922";
  return "#8b949e";
}

// ── Process icons ──

const PROCESS_ICONS: ReadonlyArray<readonly [ReadonlyArray<string>, string]> = [
  [["chrome", "chromium", "google chrome"], "\uD83C\uDF10"],
  [["firefox", "librewolf"], "\uD83E\uDD8A"],
  [["safari", "webkit"], "\uD83E\uDDED"],
  [["edge", "msedge"], "\uD83C\uDF10"],
  [["node", "bun", "deno"], "\u2B22"],
  [["python", "python3"], "\uD83D\uDC0D"],
  [["ruby", "irb"], "\uD83D\uDC8E"],
  [["java", "kotlin"], "\u2615"],
  [["go", "gopls"], "\uD83D\uDC39"],
  [["rust", "cargo", "rustc"], "\uD83E\uDD80"],
  [["postgres", "psql", "mysql", "mariadb", "mongod", "redis"], "\uD83D\uDDC4"],
  [["docker", "containerd", "dockerd"], "\uD83D\uDC33"],
  [["code", "cursor", "zed", "vim", "nvim", "emacs", "sublime"], "\u270F\uFE0F"],
  [["terminal", "iterm", "alacritty", "kitty", "wezterm", "tmux"], "\u25A0"],
  [["git", "gh"], "\uD83D\uDD00"],
  [["ssh", "sshd"], "\uD83D\uDD10"],
  [["nginx", "apache", "caddy", "httpd"], "\uD83C\uDF10"],
  [["slack", "discord", "telegram", "teams"], "\uD83D\uDCAC"],
  [["spotify", "music"], "\u266B"],
  [["finder", "explorer"], "\uD83D\uDCC2"],
  [["launchd", "systemd", "init"], "\u2699\uFE0F"],
  [["kernel_task", "kworker", "ksoftirqd"], "\u2699\uFE0F"],
  [["windowserver", "dwm", "xorg", "wayland"], "\uD83D\uDDA5"],
  [["spotlight", "mds", "mdworker"], "\uD83D\uDD0D"],
];

function getProcessIcon(name: string): string {
  const lower = name.toLowerCase();
  for (const [keywords, icon] of PROCESS_ICONS) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) return icon;
    }
  }
  return "\u25CB";
}

// ── Shared styles ──

const card: React.CSSProperties = {
  border: "1px solid #30363d",
  borderRadius: 6,
  background: "#0d1117",
};

const label: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "#8b949e",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

// ── Dashboard ──

function StatCard({ icon, title, value, accent }: {
  readonly icon: string;
  readonly title: string;
  readonly value: string;
  readonly accent?: string;
}): React.ReactElement {
  return (
    <div style={{ ...card, padding: "12px 14px", flex: 1 }}>
      <div style={{ ...label, marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ fontSize: 12 }}>{icon}</span> {title}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: accent ?? "#e6edf3", lineHeight: 1 }}>{value}</div>
    </div>
  );
}

export function Dashboard({
  hostname, platform, uptime, cpuUsage, memoryTotal, memoryUsed, processCount,
}: InferClientProps<typeof DashboardDef>): React.ReactElement {
  const memPercent = Math.round((memoryUsed / memoryTotal) * 100);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#e6edf3" }}>{hostname}</div>
        <div style={{ fontSize: 12, color: "#484f58" }}>{platform} · up {formatUptime(uptime)}</div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <StatCard icon="◎" title="CPU" value={`${cpuUsage}%`} accent={cpuUsage > 80 ? "#f85149" : undefined} />
        <StatCard icon="▦" title="Memory" value={`${memPercent}%`} accent={memPercent > 90 ? "#f85149" : undefined} />
        <StatCard icon="⬡" title="Processes" value={String(processCount)} />
        <div style={{ ...card, padding: "12px 14px", flex: 1 }}>
          <div style={{ ...label, marginBottom: 6 }}>⧖ Memory Detail</div>
          <div style={{ fontSize: 12, color: "#8b949e", lineHeight: 1.6 }}>
            <span style={{ color: "#e6edf3" }}>{formatBytes(memoryUsed)}</span> / {formatBytes(memoryTotal)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Process Table ──

export function ProcessTable({ processes, sortBy, onKill, onSort, onRefresh }: InferClientProps<typeof ProcessTableDef>): React.ReactElement {
  const killProcess = onKill.mutate;
  const sortProcesses = onSort.mutate;
  const refreshProcesses = onRefresh.mutate;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "0 16px 8px" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
        <span style={{ ...label, flex: 1 }}>⧉ Processes · top {processes.length} by {sortBy}</span>
        <button onClick={() => refreshProcesses()} style={{
          background: "#21262d", border: "1px solid #30363d", color: "#c9d1d9", borderRadius: 6,
          padding: "3px 10px", fontSize: 11, cursor: "pointer",
        }}>
          Refresh
        </button>
      </div>

      <div style={{ ...card, flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <ProcessHeader sortBy={sortBy} onSort={sortProcesses} />
        <div style={{ flex: 1, overflow: "auto" }}>
          {processes.map((proc) => (
            <ProcessRow key={proc.pid} process={proc} onKill={killProcess} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ProcessHeader({ sortBy, onSort }: {
  readonly sortBy: string;
  readonly onSort: (field: "pid" | "name" | "cpu" | "memory") => void;
}): React.ReactElement {
  const cols: ReadonlyArray<{ key: "pid" | "name" | "cpu" | "memory"; label: string; width: string; align: "left" | "right" }> = [
    { key: "pid", label: "PID", width: "64px", align: "right" },
    { key: "name", label: "Command", width: "1fr", align: "left" },
    { key: "cpu", label: "CPU", width: "56px", align: "right" },
    { key: "memory", label: "Mem", width: "72px", align: "right" },
  ];

  return (
    <div style={{
      display: "grid", gridTemplateColumns: cols.map((col) => col.width).join(" ") + " 32px",
      padding: "6px 10px", borderBottom: "1px solid #21262d", fontSize: 11, color: "#484f58",
    }}>
      {cols.map((col) => (
        <div
          key={col.key}
          onClick={() => onSort(col.key)}
          style={{ textAlign: col.align, cursor: "pointer", fontWeight: sortBy === col.key ? 600 : 400, color: sortBy === col.key ? "#8b949e" : undefined }}
        >
          {col.label}{sortBy === col.key ? " ▾" : ""}
        </div>
      ))}
      <div />
    </div>
  );
}

function ProcessRow({ process: proc, onKill }: {
  readonly process: { readonly pid: number; readonly name: string; readonly cpu: number; readonly memory: number };
  readonly onKill: (pid: number) => void;
}): React.ReactElement {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "64px 1fr 56px 72px 32px",
      padding: "4px 10px", borderBottom: "1px solid #161b22", fontSize: 12, alignItems: "center",
    }}>
      <div style={{ textAlign: "right", color: "#484f58", fontFamily: "monospace", fontSize: 11 }}>{proc.pid}</div>
      <div style={{ color: "#c9d1d9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingLeft: 8, display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ fontSize: 11, width: 14, textAlign: "center", flexShrink: 0 }}>{getProcessIcon(proc.name)}</span>
        {proc.name}
      </div>
      <div style={{ textAlign: "right", fontFamily: "monospace", fontSize: 11, color: cpuColor(proc.cpu) }}>{proc.cpu.toFixed(1)}</div>
      <div style={{ textAlign: "right", color: "#8b949e", fontFamily: "monospace", fontSize: 11 }}>{formatBytes(proc.memory)}</div>
      <div style={{ textAlign: "center" }}>
        <span
          onClick={() => onKill(proc.pid)}
          style={{ color: "#f8514944", cursor: "pointer", fontSize: 13, lineHeight: 1 }}
          onMouseEnter={(event) => { (event.target as HTMLElement).style.color = "#f85149"; }}
          onMouseLeave={(event) => { (event.target as HTMLElement).style.color = "#f8514944"; }}
        >
          ×
        </span>
      </div>
    </div>
  );
}

// ── Log Stream ──

export function LogStream({ title, lines }: InferClientProps<typeof LogStreamDef>): React.ReactElement {
  const [logLines, setLogLines] = useState<ReadonlyArray<string>>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return lines.subscribe((line: string) => {
      setLogLines((prev) => [...prev.slice(-200), `${new Date().toLocaleTimeString()} ${line}`]);
    });
  }, [lines]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logLines]);

  return (
    <div style={{ padding: "0 16px 12px", flexShrink: 0 }}>
      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ padding: "6px 10px", borderBottom: "1px solid #21262d" }}>
          <span style={label}>{title}</span>
        </div>
        <div ref={containerRef} style={{ height: 80, overflow: "auto", padding: "4px 10px" }}>
          {logLines.length === 0 && <div style={{ fontSize: 11, color: "#30363d" }}>No activity</div>}
          {logLines.map((line, index) => (
            <div key={index} style={{ fontSize: 11, fontFamily: "monospace", color: "#484f58", lineHeight: "17px", whiteSpace: "nowrap" }}>{line}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
