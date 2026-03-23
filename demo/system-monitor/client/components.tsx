import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Card,
  Table,
  Progress,
  Badge,
  Button,
  Text,
  ScrollArea,
  Divider,
} from "reshaped/bundle";
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

function usageColor(percent: number): "positive" | "primary" | "warning" | "critical" {
  if (percent < 50) return "positive";
  if (percent < 70) return "primary";
  if (percent < 90) return "warning";
  return "critical";
}

function StatCard({ label, value, subtext, percent }: {
  readonly label: string;
  readonly value: string;
  readonly subtext?: string;
  readonly percent?: number;
}): React.ReactElement {
  return (
    <Card padding={4}>
      <View gap={2}>
        <Text variant="caption-1" color="neutral-faded">{label}</Text>
        <Text variant="title-3">{value}</Text>
        {percent !== undefined && (
          <Progress value={percent} color={usageColor(percent)} size="small" />
        )}
        {subtext && <Text variant="caption-1" color="neutral-faded">{subtext}</Text>}
      </View>
    </Card>
  );
}

export function Dashboard({
  hostname, platform, uptime, cpuUsage, memoryTotal, memoryUsed, processCount,
}: InferClientProps<typeof DashboardDef>): React.ReactElement {
  const memoryPercent = Math.round((memoryUsed / memoryTotal) * 100);

  return (
    <View padding={4} gap={4}>
      <View direction="row" gap={4}>
        <View.Item columns={3}>
          <StatCard label="Host" value={hostname} subtext={`${platform} · up ${formatUptime(uptime)}`} />
        </View.Item>
        <View.Item columns={3}>
          <StatCard label="CPU" value={`${cpuUsage}%`} percent={cpuUsage} />
        </View.Item>
        <View.Item columns={3}>
          <StatCard
            label="Memory"
            value={`${memoryPercent}%`}
            percent={memoryPercent}
            subtext={`${formatBytes(memoryUsed)} / ${formatBytes(memoryTotal)}`}
          />
        </View.Item>
        <View.Item columns={3}>
          <StatCard label="Processes" value={String(processCount)} />
        </View.Item>
      </View>
    </View>
  );
}

export function ProcessTable({ processes, sortBy, onKill, onSort, onRefresh }: InferClientProps<typeof ProcessTableDef>): React.ReactElement {
  const killProcess = onKill.mutate;
  const sortProcesses = onSort.mutate;
  const refreshProcesses = onRefresh.mutate;

  type SortKey = "pid" | "name" | "cpu" | "memory";
  const columns: ReadonlyArray<{ key: SortKey; label: string; align?: "start" | "end" }> = [
    { key: "pid", label: "PID", align: "end" },
    { key: "name", label: "Name" },
    { key: "cpu", label: "CPU %", align: "end" },
    { key: "memory", label: "Memory", align: "end" },
  ];

  return (
    <View paddingInline={4} paddingBlock={2} gap={3}>
      <View direction="row" align="center" gap={3}>
        <View.Item grow>
          <Text variant="body-2" color="neutral-faded">
            Top {processes.length} processes by {sortBy}
          </Text>
        </View.Item>
        <Button variant="outline" size="small" onClick={() => refreshProcesses()}>
          Refresh
        </Button>
      </View>

      <Card padding={0}>
        <ScrollArea maxHeight="60vh" scrollbarDisplay="hover">
          <Table>
            <Table.Row highlighted>
              {columns.map((col) => (
                <Table.Heading
                  key={col.key}
                  align={col.align}
                  attributes={{ onClick: () => sortProcesses(col.key), style: { cursor: "pointer" } }}
                >
                  {col.label} {sortBy === col.key ? "▼" : ""}
                </Table.Heading>
              ))}
              <Table.Heading align="end">Action</Table.Heading>
            </Table.Row>
            {processes.map((proc) => (
              <Table.Row key={proc.pid}>
                <Table.Cell align="end">
                  <Text variant="caption-1" color="neutral-faded" monospace>{proc.pid}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Text variant="body-2" maxLines={1}>{proc.name}</Text>
                </Table.Cell>
                <Table.Cell align="end">
                  <Badge
                    color={proc.cpu > 50 ? "critical" : proc.cpu > 10 ? "warning" : "neutral"}
                    variant="faded"
                    size="small"
                  >
                    {proc.cpu.toFixed(1)}
                  </Badge>
                </Table.Cell>
                <Table.Cell align="end">
                  <Text variant="caption-1" monospace>{formatBytes(proc.memory)}</Text>
                </Table.Cell>
                <Table.Cell align="end">
                  <Button
                    variant="ghost"
                    color="critical"
                    size="small"
                    onClick={() => killProcess(proc.pid)}
                  >
                    Kill
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table>
        </ScrollArea>
      </Card>
    </View>
  );
}

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
    <View paddingInline={4} paddingBlock={2}>
      <Card padding={0}>
        <View padding={4} paddingBlock={3}>
          <Text variant="body-2" weight="medium">{title}</Text>
        </View>
        <Divider />
        <ScrollArea maxHeight="120px" scrollbarDisplay="hover">
          <View padding={4} gap={1}>
            {logLines.length === 0 && (
              <Text variant="caption-1" color="disabled">No activity yet</Text>
            )}
            {logLines.map((line, index) => (
              <Text key={index} variant="caption-1" monospace color="neutral-faded">{line}</Text>
            ))}
          </View>
        </ScrollArea>
      </Card>
    </View>
  );
}
