import React, { useCallback, useMemo, useState } from "react";
import { Render } from "@playfast/echoform-render";
import { Server } from "@playfast/echoform/server";
import { createBunWebSocketServer } from "@playfast/echoform-bun-ws-server";
import {
  DashboardApp,
  ErrorPanel,
  PluginEditor,
  RuntimeStatus,
  WidgetFrame,
  WidgetGrid,
} from "../shared/views";
import type { BundleRequest, ReorderRequest, SourceChangeRequest, WidgetDescriptor } from "../shared/plugin-types";
import { bundlePluginSource } from "./bundle-plugin";

const seedWidgets: readonly WidgetDescriptor[] = [
  {
    id: "revenue",
    title: "Revenue Metric",
    kind: "metric",
    layout: "hero",
    data: {
      label: "Revenue",
      value: 128400,
      delta: "+12.8%",
      goal: 150000,
      runRate: "$18.3k/day",
      renewals: "$54.2k",
      expansion: "$42.8k",
    },
  },
  {
    id: "traffic",
    title: "Traffic Trend",
    kind: "chart",
    layout: "wide",
    data: {
      label: "Visitors",
      points: [8, 12, 11, 19, 22, 25, 31, 28, 34],
      mobileShare: "68% mobile",
      returning: "41%",
    },
  },
  {
    id: "signups",
    title: "Recent Signups",
    kind: "table",
    layout: "tall",
    data: {
      label: "Signups",
      columns: ["name", "plan", "seats"],
      editableColumns: [
        { key: "name", label: "Account", kind: "text" },
        {
          key: "plan",
          label: "Plan",
          kind: "select",
          options: [
            { label: "Team", value: "Team" },
            { label: "Pro", value: "Pro" },
            { label: "Enterprise", value: "Enterprise" },
          ],
        },
        { key: "seats", label: "Seats", kind: "number" },
      ],
      rows: [
        { id: "northwind", name: "Northwind", plan: "Team", seats: 18 },
        { id: "acme", name: "Acme Labs", plan: "Pro", seats: 7 },
        { id: "globex", name: "Globex", plan: "Enterprise", seats: 44 },
      ],
    },
  },
  {
    id: "counter",
    title: "Action Counter",
    kind: "action",
    layout: "compact",
    data: { label: "Manual actions" },
  },
  {
    id: "ops",
    title: "Ops Health",
    kind: "custom",
    layout: "tall",
    data: {
      uptime: 99.97,
      latency: 142,
      errorRate: 0.08,
      errorBudget: 82,
      regions: [
        { label: "us-east", value: "healthy", tone: "success" },
        { label: "eu-west", value: "watch", tone: "warning" },
        { label: "ap-south", value: "healthy", tone: "success" },
      ],
      timeline: [
        { title: "Edge cache warmed", meta: "08:10", tone: "success" },
        { title: "EU latency budget tight", meta: "09:35", tone: "warning" },
        { title: "Autoscale policy updated", meta: "10:20", tone: "default" },
      ],
    },
  },
  {
    id: "pipeline",
    title: "Pipeline Forecast",
    kind: "metric",
    layout: "wide",
    data: {
      forecast: 842000,
      target: 900000,
      closeRate: 68,
      points: [42, 48, 47, 52, 61, 64, 69, 73],
      segments: [
        { label: "Enterprise", value: "$418k", tone: "success" },
        { label: "Mid market", value: "$276k", tone: "default" },
        { label: "SMB", value: "$148k", tone: "muted" },
      ],
    },
  },
  {
    id: "support",
    title: "Support Queue",
    kind: "table",
    layout: "wide",
    data: {
      open: 37,
      breached: 3,
      firstReply: "14m",
      columns: ["team", "open", "sla"],
      editableColumns: [
        {
          key: "team",
          label: "Team",
          kind: "select",
          options: [
            { label: "Billing", value: "Billing" },
            { label: "Platform", value: "Platform" },
            { label: "Security", value: "Security" },
          ],
        },
        { key: "open", label: "Open", kind: "number" },
        {
          key: "sla",
          label: "SLA",
          kind: "select",
          options: [
            { label: "Green", value: "green" },
            { label: "Amber", value: "amber" },
            { label: "Red", value: "red" },
          ],
        },
        { key: "owner", label: "Owner", kind: "text" },
      ],
      rows: [
        { id: "billing", team: "Billing", open: 12, sla: "green", owner: "Mira" },
        { id: "platform", team: "Platform", open: 18, sla: "amber", owner: "Jon" },
        { id: "security", team: "Security", open: 7, sla: "green", owner: "Nia" },
      ],
    },
  },
  {
    id: "experiment",
    title: "Experiment Readout",
    kind: "chart",
    layout: "standard",
    data: {
      lift: 7.4,
      confidence: 94,
      cohorts: [18, 21, 24, 29, 32, 31, 35],
      checkpoints: [
        { title: "Traffic balanced", meta: "50/50 split", tone: "success" },
        { title: "Guardrail clean", meta: "No checkout regression", tone: "success" },
      ],
    },
  },
  {
    id: "infra-cost",
    title: "Infrastructure Cost",
    kind: "chart",
    layout: "wide",
    data: {
      spend: 48200,
      delta: "-6.1%",
      budgetUsed: 72,
      points: [63, 66, 69, 70, 67, 61, 58, 55],
      drivers: [
        { label: "Compute", value: "$25.1k", tone: "default" },
        { label: "Storage", value: "$9.6k", tone: "muted" },
        { label: "Network", value: "$13.5k", tone: "warning" },
      ],
    },
  },
  {
    id: "release",
    title: "Release Checklist",
    kind: "action",
    layout: "tall",
    data: {
      release: "2026.06",
      checks: [
        { label: "API compatibility", done: true, detail: "Schema diff reviewed" },
        { label: "Load test", done: true, detail: "p95 inside target" },
        { label: "Security review", done: false, detail: "Pending signoff" },
        { label: "Runbook update", done: false, detail: "Owner assigned" },
      ],
    },
  },
  {
    id: "regional",
    title: "Regional Performance",
    kind: "table",
    layout: "standard",
    data: {
      columns: ["region", "revenue", "growth"],
      rows: [
        { region: "North America", revenue: "$420k", growth: "+14%" },
        { region: "Europe", revenue: "$318k", growth: "+9%" },
        { region: "APAC", revenue: "$204k", growth: "+18%" },
      ],
      mix: [
        { label: "Expansion", value: "61%", tone: "success" },
        { label: "New logo", value: "27%", tone: "default" },
        { label: "Services", value: "12%", tone: "muted" },
      ],
    },
  },
  {
    id: "inventory",
    title: "Inventory Alerts",
    kind: "custom",
    layout: "standard",
    data: {
      fillRate: 87,
      columns: ["sku", "days", "risk"],
      editableColumns: [
        { key: "sku", label: "SKU", kind: "text" },
        { key: "days", label: "Days", kind: "number", suffix: "d" },
        {
          key: "risk",
          label: "Risk",
          kind: "select",
          options: [
            { label: "Low", value: "low" },
            { label: "Medium", value: "medium" },
            { label: "High", value: "high" },
          ],
        },
        { key: "owner", label: "Owner", kind: "text" },
      ],
      rows: [
        { id: "core-xl", sku: "Core-XL", days: 6, risk: "high", owner: "Ops" },
        { id: "edge-pro", sku: "Edge-Pro", days: 11, risk: "medium", owner: "Supply" },
        { id: "lite", sku: "Lite", days: 21, risk: "low", owner: "Retail" },
      ],
    },
  },
  {
    id: "eng",
    title: "Engineering Flow",
    kind: "custom",
    layout: "standard",
    data: {
      merged: 42,
      reviewAge: "9h",
      deploys: [3, 4, 2, 5, 6, 4, 7],
      blockers: [
        { title: "Design QA", meta: "Mobile breakpoint", tone: "warning" },
        { title: "Migration dry run", meta: "Ready", tone: "success" },
      ],
    },
  },
];

function moveWidget(widgets: readonly WidgetDescriptor[], reorder: ReorderRequest): readonly WidgetDescriptor[] {
  const fromIndex = widgets.findIndex((widget) => widget.id === reorder.activeId);
  const toIndex = widgets.findIndex((widget) => widget.id === reorder.overId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return widgets;

  const next = [...widgets];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return widgets;
  next.splice(toIndex, 0, moved);
  return next;
}

function cloneWidget(widget: WidgetDescriptor): WidgetDescriptor {
  const cloneId = `${widget.id}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    ...widget,
    id: cloneId,
    title: `${widget.title} Copy`,
  };
}

function Dashboard(): React.ReactElement {
  const [widgets, setWidgets] = useState<readonly WidgetDescriptor[]>(seedWidgets);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(seedWidgets[0]?.id ?? null);
  const [sources, setSources] = useState<Readonly<Record<string, string>>>({});
  const [error, setError] = useState<string | null>(null);

  const selectedSource = selectedWidgetId ? sources[selectedWidgetId] ?? "" : "";

  const handleRemove = useCallback((widgetId: string) => {
    setWidgets((current) => current.filter((widget) => widget.id !== widgetId));
    setSelectedWidgetId((current) => (current === widgetId ? null : current));
  }, []);

  const handleDuplicate = useCallback((widgetId: string) => {
    setWidgets((current) => {
      const source = current.find((widget) => widget.id === widgetId);
      if (!source) return current;
      const clone = cloneWidget(source);
      setSelectedWidgetId(clone.id);
      setSources((currentSources) => ({
        ...currentSources,
        [clone.id]: currentSources[widgetId] ?? "",
      }));
      return [...current, clone];
    });
  }, []);

  const handleSourceChange = useCallback((request: SourceChangeRequest) => {
    setSources((current) => ({ ...current, [request.widgetId]: request.source }));
  }, []);

  const handleBundle = useCallback(async (request: BundleRequest) => {
    setSources((current) => ({ ...current, [request.widgetId]: request.source }));
    const result = await bundlePluginSource(request.widgetId, request.source);
    if (!result.ok) setError(result.error);
    return result;
  }, []);

  const selectedWidget = useMemo(
    () => widgets.find((widget) => widget.id === selectedWidgetId) ?? null,
    [selectedWidgetId, widgets],
  );

  return (
    <DashboardApp title="Echoform Widget Plugins" selectedWidgetId={selectedWidgetId} onSelectWidget={setSelectedWidgetId}>
      {error && <ErrorPanel message={error} onDismiss={() => setError(null)} />}
      <RuntimeStatus workerCount={0} runningCount={0} errorCount={0} />
      <WidgetGrid
        widgets={widgets}
        selectedWidgetId={selectedWidgetId}
        onReorder={(request) => setWidgets((current) => moveWidget(current, request))}
        onSelectWidget={setSelectedWidgetId}
      >
        {widgets.map((widget) => (
          <WidgetFrame
            key={widget.id}
            widget={widget}
            selected={widget.id === selectedWidgetId}
            status="idle"
            error={null}
            onSelectWidget={setSelectedWidgetId}
            onDuplicate={handleDuplicate}
            onRemove={handleRemove}
            onBundle={handleBundle}
          />
        ))}
      </WidgetGrid>
      <PluginEditor
        widgetId={selectedWidget?.id ?? null}
        source={selectedSource}
        bundleError={error}
        onSourceChange={handleSourceChange}
        onBundle={handleBundle}
      />
    </DashboardApp>
  );
}

const PORT = Number.parseInt(process.env["PORT"] ?? "4241", 10);

const { transport, start } = createBunWebSocketServer({
  port: PORT,
  path: "/ws",
});

const server = start();

console.log(`Widget plugin server running on ws://localhost:${PORT}/ws`);

process.on("SIGINT", () => {
  server.stop();
  process.exit(0);
});

process.on("SIGTERM", () => {
  server.stop();
  process.exit(0);
});

Render(
  <Server transport={transport} singleInstance>
    {() => <Dashboard />}
  </Server>,
);
