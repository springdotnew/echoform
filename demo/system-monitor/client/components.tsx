import React, { useState, useEffect, useRef, useMemo } from "react";
import { Card, Table, Chip, Button, ProgressBar, ScrollShadow, Tooltip } from "@heroui/react";
import type { SortDescriptor } from "@heroui/react";
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

function usageColor(percent: number): "success" | "warning" | "danger" {
  if (percent < 60) return "success";
  if (percent < 85) return "warning";
  return "danger";
}

// ── Process icons ──

const PROCESS_ICONS: ReadonlyArray<readonly [ReadonlyArray<string>, string]> = [
  [["chrome", "chromium", "google chrome"], "\uD83C\uDF10"],
  [["firefox", "librewolf"], "\uD83E\uDD8A"],
  [["safari", "webkit"], "\uD83E\uDDED"],
  [["node", "bun", "deno"], "\u2B22"],
  [["python", "python3"], "\uD83D\uDC0D"],
  [["ruby"], "\uD83D\uDC8E"],
  [["java", "kotlin"], "\u2615"],
  [["go", "gopls"], "\uD83D\uDC39"],
  [["rust", "cargo"], "\uD83E\uDD80"],
  [["postgres", "mysql", "mongod", "redis"], "\uD83D\uDDC4"],
  [["docker", "containerd"], "\uD83D\uDC33"],
  [["code", "cursor", "zed", "vim", "nvim"], "\u270F\uFE0F"],
  [["terminal", "iterm", "alacritty", "kitty", "wezterm"], "\u25A0"],
  [["git", "gh"], "\uD83D\uDD00"],
  [["ssh", "sshd"], "\uD83D\uDD10"],
  [["nginx", "apache", "caddy"], "\uD83C\uDF10"],
  [["slack", "discord", "telegram"], "\uD83D\uDCAC"],
  [["spotify", "music"], "\u266B"],
  [["finder", "explorer"], "\uD83D\uDCC2"],
  [["launchd", "systemd", "init", "kernel_task"], "\u2699\uFE0F"],
  [["windowserver", "dwm"], "\uD83D\uDDA5"],
  [["spotlight", "mds"], "\uD83D\uDD0D"],
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

// ── Dashboard ──

function StatCard({ label, value, percent }: {
  readonly label: string;
  readonly value: string;
  readonly percent?: number;
}): React.ReactElement {
  return (
    <Card className="flex-1">
      <Card.Header>
        <Card.Description>{label}</Card.Description>
        <Card.Title className="text-2xl font-bold tabular-nums">{value}</Card.Title>
      </Card.Header>
      {percent !== undefined && (
        <Card.Content className="pt-0">
          <ProgressBar value={percent} color={usageColor(percent)} size="sm" aria-label={label}>
            <ProgressBar.Track><ProgressBar.Fill /></ProgressBar.Track>
          </ProgressBar>
        </Card.Content>
      )}
    </Card>
  );
}

export function Dashboard({
  hostname, platform, uptime, cpuUsage, memoryTotal, memoryUsed, processCount,
}: InferClientProps<typeof DashboardDef>): React.ReactElement {
  const memPercent = Math.round((memoryUsed / memoryTotal) * 100);

  return (
    <div className="p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold">{hostname}</p>
        <p className="text-xs text-default-400">{platform} · up {formatUptime(uptime)}</p>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="CPU" value={`${cpuUsage}%`} percent={cpuUsage} />
        <StatCard label="Memory" value={`${memPercent}%`} percent={memPercent} />
        <StatCard label="Processes" value={String(processCount)} />
        <Card className="flex-1">
          <Card.Header>
            <Card.Description>Memory Detail</Card.Description>
          </Card.Header>
          <Card.Content className="pt-0">
            <p className="text-xs tabular-nums">
              <span className="text-foreground font-medium">{formatBytes(memoryUsed)}</span>
              <span className="text-default-400"> / {formatBytes(memoryTotal)}</span>
            </p>
          </Card.Content>
        </Card>
      </div>
    </div>
  );
}

// ── Process Table ──

type ProcessItem = { readonly pid: number; readonly name: string; readonly cpu: number; readonly memory: number };

const tableColumns = [
  { id: "pid", label: "PID", allowsSorting: true },
  { id: "name", label: "Command", allowsSorting: true },
  { id: "cpu", label: "CPU", allowsSorting: true },
  { id: "memory", label: "Memory", allowsSorting: true },
  { id: "actions", label: "", allowsSorting: false },
];

export function ProcessTable({ processes, sortBy, onKill, onSort, onRefresh }: InferClientProps<typeof ProcessTableDef>): React.ReactElement {
  const killProcess = onKill.mutate;
  const sortProcesses = onSort.mutate;
  const refreshProcesses = onRefresh.mutate;

  const sortDescriptor: SortDescriptor = useMemo(() => ({
    column: sortBy,
    direction: "descending" as const,
  }), [sortBy]);

  const handleSortChange = (descriptor: SortDescriptor): void => {
    if (descriptor.column) {
      sortProcesses(descriptor.column as "pid" | "name" | "cpu" | "memory");
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden px-4 pb-2">
      <div className="flex items-center mb-2">
        <p className="flex-1 text-xs text-default-400">Top {processes.length} by {sortBy}</p>
        <Button variant="outline" size="sm" onPress={() => refreshProcesses()}>Refresh</Button>
      </div>

      <Table className="flex-1">
        <Table.ScrollContainer>
          <Table.Content
            aria-label="Process list"
            sortDescriptor={sortDescriptor}
            onSortChange={handleSortChange}
          >
            <Table.Header>
              {tableColumns.map((col) => (
                <Table.Column key={col.id} id={col.id} allowsSorting={col.allowsSorting}>
                  {col.label}
                </Table.Column>
              ))}
            </Table.Header>
            <Table.Body items={processes as ReadonlyArray<ProcessItem>}>
              {(proc: ProcessItem) => (
                <Table.Row key={proc.pid}>
                  <Table.Cell>
                    <span className="text-xs text-default-400 tabular-nums font-mono">{proc.pid}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-xs">
                      <span className="mr-1.5">{getProcessIcon(proc.name)}</span>
                      {proc.name}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <Chip
                      size="sm"
                      variant="soft"
                      color={proc.cpu > 50 ? "danger" : proc.cpu > 10 ? "warning" : "default"}
                    >
                      {proc.cpu.toFixed(1)}%
                    </Chip>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="text-xs text-default-400 tabular-nums font-mono">{formatBytes(proc.memory)}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <Tooltip>
                      <Tooltip.Trigger>
                        <Button variant="ghost" color="danger" size="sm" isIconOnly onPress={() => killProcess(proc.pid)}>
                          ×
                        </Button>
                      </Tooltip.Trigger>
                      <Tooltip.Content>Kill process {proc.pid}</Tooltip.Content>
                    </Tooltip>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
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
    <div className="px-4 pb-3 shrink-0">
      <Card>
        <Card.Header className="py-2">
          <Card.Description className="text-xs uppercase tracking-wide">{title}</Card.Description>
        </Card.Header>
        <Card.Content className="pt-0">
          <ScrollShadow className="h-20" hideScrollBar>
            <div ref={containerRef} className="space-y-0.5">
              {logLines.length === 0 && <p className="text-xs text-default-300">No activity</p>}
              {logLines.map((line, index) => (
                <p key={index} className="text-[11px] font-mono text-default-400 whitespace-nowrap">{line}</p>
              ))}
            </div>
          </ScrollShadow>
        </Card.Content>
      </Card>
    </div>
  );
}
