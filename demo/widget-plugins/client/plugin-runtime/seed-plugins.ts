export const seedSources: Readonly<Record<string, string>> = {
  revenue: `import { Stack, Section, Badge, MetricCard, ProgressBar, StatList, TextBlock, ActionButton, SegmentedControl } from "@widget/ui";
import type { WidgetComponentProps } from "@widget/ui";

type Props = WidgetComponentProps<Record<string, any>, Record<string, any>>;

export default function Widget({ state, setState, data }: Props) {
  const boost = state.boost ?? 0;
  const view = state.view ?? "today";
  const scenarioLift = view === "forecast" ? 7200 : view === "week" ? 3200 : 0;
  const value = data.value + boost + scenarioLift;
  const goal = data.goal ?? 150000;
  const attainment = Math.min(100, Math.round((value / goal) * 100));
  return (
    <Section title="Revenue Metric" description="Finance glance with local scenario state">
      <Stack direction="horizontal" gap="sm">
        <Badge label={view === "forecast" ? "Forecast" : "Live"} tone={view === "forecast" ? "warning" : "success"} />
        <Badge label={data.delta} tone="success" />
        <Badge label={attainment + "%"} tone={attainment >= 90 ? "success" : "warning"} />
      </Stack>
      <SegmentedControl
        label="Scope"
        value={view}
        options={[{ label: "Today", value: "today" }, { label: "7d", value: "week" }, { label: "Plan", value: "forecast" }]}
        onChange={(next) => setState({ view: next })}
      />
      <MetricCard title={data.label} value={"$" + Math.round(value / 1000) + "k"} delta={view === "forecast" ? "scenario" : "booked now"} tone="success" />
      <ProgressBar label="Plan ring" value={attainment} tone={attainment >= 90 ? "success" : "warning"} />
      <StatList items={[
        { label: "Run rate", value: data.runRate ?? "$18.3k/day", tone: "default" },
        { label: "Renewals", value: data.renewals ?? "$54.2k", tone: "success" },
        { label: "Expansion", value: data.expansion ?? "$42.8k", tone: "success" },
        { label: "Boost", value: "$" + boost, tone: boost > 0 ? "success" : "muted" }
      ]} />
      <Stack direction="horizontal" gap="sm">
        <ActionButton label="Add 500" variant="primary" onClick={() => setState({ boost: boost + 500 })} />
        <ActionButton label="Clear" variant="secondary" onClick={() => setState({ boost: 0 })} />
      </Stack>
      <TextBlock text={view === "forecast" ? "Scenario includes expected end-of-day renewals." : "Compact finance widget state is local to the plugin."} tone="muted" />
    </Section>
  );
}
`,
  traffic: `import { Stack, Section, Badge, LineChart, SparkBars, TextBlock, SegmentedControl, SliderControl, StatList } from "@widget/ui";
import type { WidgetComponentProps } from "@widget/ui";

type Props = WidgetComponentProps<Record<string, any>, Record<string, any>>;

export default function Widget({ state, setState, data }: Props) {
  const lift = state.lift ?? 0;
  const range = state.range ?? "live";
  const base = range === "pulse" ? data.points.slice(-6) : range === "forecast" ? data.points.map((point: number) => Math.round(point * 1.18)) : data.points;
  const points = base.map((point: number) => point + lift);
  const peak = Math.max(...points);
  const current = points[points.length - 1] ?? 0;
  return (
    <Section title="Traffic Trend" description="Safari-style traffic pulse with preview controls">
      <Stack direction="horizontal" gap="sm">
        <Badge label={range === "forecast" ? "Later" : "Now"} tone={range === "forecast" ? "warning" : "success"} />
        <Badge label={"Peak " + peak} tone="success" />
        <Badge label={data.mobileShare ?? "68% mobile"} tone="default" />
      </Stack>
      <StatList items={[
        { label: "Visitors now", value: current, tone: "success" },
        { label: "Returning", value: data.returning ?? "41%", tone: "default" },
        { label: "Lift preview", value: "+" + lift, tone: lift > 0 ? "warning" : "muted" }
      ]} />
      <SegmentedControl
        label="Window"
        value={range}
        options={[{ label: "Live", value: "live" }, { label: "Pulse", value: "pulse" }, { label: "Later", value: "forecast" }]}
        onChange={(next) => setState({ range: next })}
      />
      <SparkBars title="Minute bars" values={points} tone={range === "forecast" ? "warning" : "success"} />
      <LineChart title={data.label} points={points} />
      <SliderControl label="Preview lift" value={lift} min={0} max={12} step={1} unit="k" onChange={(next) => setState({ lift: next })} />
      <TextBlock text={range === "pulse" ? "Showing the latest six windows only." : "Chart and bars share the same local preview."} tone="muted" />
    </Section>
  );
}
`,
  signups: `import { Stack, Section, Badge, EditableTable, StatList, ProgressBar, TextBlock, SegmentedControl } from "@widget/ui";
import type { WidgetComponentProps } from "@widget/ui";

type Props = WidgetComponentProps<Record<string, any>, Record<string, any>>;

export default function Widget({ state, setState, data }: Props) {
  const plan = state.plan ?? "all";
  const edits = state.edits ?? {};
  const accounts = data.rows.map((row: any) => ({ ...row, ...(edits[row.id] ?? {}) }));
  const rows = accounts.filter((row: any) => plan === "all" || String(row.plan).toLowerCase() === plan);
  const seats = rows.reduce((sum: number, row: any) => sum + row.seats, 0);
  const largest = rows.reduce((max: any, row: any) => row.seats > (max?.seats ?? 0) ? row : max, null);
  const handleCellChange = (change: any) => {
    const value = change.column === "seats" ? Number(change.value) : change.value;
    setState({
      edits: {
        ...edits,
        [change.rowId]: { ...(edits[change.rowId] ?? {}), [change.column]: value }
      }
    });
  };
  return (
    <Section title="Recent Signups" description="Contacts-style account intake">
      <Stack direction="horizontal" gap="sm">
        <Badge label="CRM" tone="default" />
        <Badge label={rows.length + " accounts"} tone="success" />
        <Badge label={seats + " seats"} tone="success" />
      </Stack>
      <TextBlock text="Generated table widget" tone="muted" />
      <SegmentedControl
        label="Plan"
        value={plan}
        options={[{ label: "All", value: "all" }, { label: "Team", value: "team" }, { label: "Pro", value: "pro" }, { label: "Ent", value: "enterprise" }]}
        onChange={(next) => setState({ plan: next })}
      />
      <StatList items={[
        { label: "New seats", value: seats, tone: "success" },
        { label: "Largest", value: largest ? largest.name : "None", tone: largest ? "default" : "muted" },
        { label: "Activation", value: "74%", tone: "success" }
      ]} />
      <ProgressBar label="Activation target" value={74} tone="success" />
      <EditableTable columns={data.editableColumns} rows={rows} density="compact" onCellChange={handleCellChange} />
    </Section>
  );
}
`,
  counter: `import { Stack, Section, MetricCard, ActionButton, Checklist, Notice, TextBlock, ToggleSwitch, Badge } from "@widget/ui";
import type { WidgetComponentProps } from "@widget/ui";

type Props = WidgetComponentProps<Record<string, any>, Record<string, any>>;

export default function Widget({ state, setState, data }: Props) {
  const count = state.count ?? 0;
  const armed = state.armed ?? true;
  const limit = armed ? 4 : 8;
  const crossed = count >= limit;
  return (
    <Section title="Action Counter" description="Shortcuts-style local command tile">
      <Stack direction="horizontal" gap="sm">
        <Badge label={armed ? "Armed" : "Relaxed"} tone={armed ? "warning" : "default"} />
        <Badge label={crossed ? "Limit" : "Ready"} tone={crossed ? "danger" : "success"} />
      </Stack>
      <MetricCard title={data.label} value={count} delta={"limit " + limit} tone={crossed ? "danger" : count > 0 ? "success" : "default"} />
      <Stack direction="horizontal" gap="sm">
        <ActionButton label="Increment" variant="primary" onClick={() => setState({ count: count + 1 })} />
        <ActionButton label="Reset" variant="secondary" onClick={() => setState({ count: 0 })} />
      </Stack>
      <ToggleSwitch label="Strict limit" checked={armed} description="Use the smaller automation threshold" onChange={(checked) => setState({ armed: checked })} />
      <Checklist items={[
        { label: "Callback fired", done: count > 0, detail: "Button crossed the worker boundary" },
        { label: "Threshold clear", done: !crossed, detail: crossed ? "Reset or relax the limit" : "Automation can continue" }
      ]} />
      {crossed ? <Notice title="Limit reached" message="The local action counter needs attention." tone="danger" /> : <TextBlock text="State is held inside the widget runtime." tone="muted" />}
    </Section>
  );
}
`,
  ops: `import { Stack, Section, Badge, MetricCard, ProgressBar, StatList, Timeline, Notice, ToggleSwitch, SegmentedControl } from "@widget/ui";
import type { WidgetComponentProps } from "@widget/ui";

type Props = WidgetComponentProps<Record<string, any>, Record<string, any>>;

export default function Widget({ state, setState, data }: Props) {
  const incidentMode = state.incidentMode ?? false;
  const focus = state.focus ?? "edge";
  const latency = data.latency + (incidentMode ? 18 : focus === "db" ? 9 : 0);
  const errorBudget = incidentMode ? Math.max(0, data.errorBudget - 18) : data.errorBudget;
  return (
    <Section title="Ops Health" description="Control Center status board">
      <Stack direction="horizontal" gap="sm">
        <Badge label="SLO" tone={errorBudget > 70 ? "success" : "warning"} />
        <Badge label={incidentMode ? "Incident" : "Watch"} tone={incidentMode ? "danger" : "warning"} />
        <Badge label={focus === "edge" ? "Edge" : focus === "db" ? "DB" : "Deploy"} tone="default" />
      </Stack>
      <SegmentedControl
        label="Focus"
        value={focus}
        options={[{ label: "Edge", value: "edge" }, { label: "DB", value: "db" }, { label: "Deploy", value: "release" }]}
        onChange={(next) => setState({ focus: next })}
      />
      <ToggleSwitch label="Incident mode" checked={incidentMode} description="Promote warnings and operator context" onChange={(checked) => setState({ incidentMode: checked })} />
      <Stack direction="horizontal" gap="md">
        <MetricCard title="Uptime" value={data.uptime + "%"} delta="30d" tone="success" />
        <MetricCard title="p95" value={latency + "ms"} delta={focus} tone={latency > 155 ? "danger" : "warning"} />
      </Stack>
      <ProgressBar label="Error budget remaining" value={errorBudget} tone={errorBudget > 70 ? "success" : "warning"} />
      <StatList items={data.regions} />
      <Timeline items={data.timeline} />
      <Notice title={incidentMode ? "Operator focus" : "Watch item"} message={incidentMode ? "Route EU traffic through fallback POPs until p95 normalizes." : "EU latency is close to the alert boundary."} tone={incidentMode ? "danger" : "warning"} />
    </Section>
  );
}
`,
  pipeline: `import { Stack, Section, Badge, MetricCard, ProgressBar, StatList, LineChart, SliderControl, SegmentedControl, Notice } from "@widget/ui";
import type { WidgetComponentProps } from "@widget/ui";

type Props = WidgetComponentProps<Record<string, any>, Record<string, any>>;

export default function Widget({ state, setState, data }: Props) {
  const upside = state.upside ?? 0;
  const lens = state.lens ?? "weighted";
  const multiplier = lens === "commit" ? 0.92 : lens === "best" ? 1.12 : 1;
  const forecast = Math.round((data.forecast + upside * 25000) * multiplier);
  const attainment = Math.min(100, Math.round((forecast / data.target) * 100));
  return (
    <Section title="Pipeline forecast" description="Forecast dial with adjustable deal model">
      <Stack direction="horizontal" gap="sm">
        <Badge label={lens === "best" ? "Best case" : lens === "commit" ? "Commit" : "Weighted"} tone={attainment >= 90 ? "success" : "warning"} />
        <Badge label={data.closeRate + "% close"} tone="success" />
      </Stack>
      <MetricCard title="Forecast" value={"$" + Math.round(forecast / 1000) + "k"} delta={attainment + "% target"} tone={attainment >= 90 ? "success" : "warning"} />
      <SegmentedControl
        label="Lens"
        value={lens}
        options={[{ label: "Commit", value: "commit" }, { label: "Weighted", value: "weighted" }, { label: "Best", value: "best" }]}
        onChange={(next) => setState({ lens: next })}
      />
      <ProgressBar label="Target coverage" value={attainment} tone={attainment >= 90 ? "success" : "warning"} />
      <SliderControl label="Upside" value={upside} min={0} max={6} step={1} unit="deals" onChange={(next) => setState({ upside: next })} />
      <LineChart title="Stage movement" points={data.points.map((point: number) => Math.round(point * multiplier))} />
      <StatList items={data.segments} />
      <Notice title="Next action" message={attainment >= 95 ? "Protect commit deals and prep signature steps." : "Pull one expansion deal into commit before Friday."} tone={attainment >= 95 ? "success" : "warning"} />
    </Section>
  );
}
`,
  support: `import { Stack, Section, Badge, MetricCard, EditableTable, Notice, SegmentedControl, ToggleSwitch, ActionButton, StatList } from "@widget/ui";
import type { WidgetComponentProps } from "@widget/ui";

type Props = WidgetComponentProps<Record<string, any>, Record<string, any>>;

export default function Widget({ state, setState, data }: Props) {
  const triaged = state.triaged ?? 0;
  const team = state.team ?? "all";
  const breachedOnly = state.breachedOnly ?? false;
  const edits = state.edits ?? {};
  const queues = data.rows.map((row: any) => ({ ...row, ...(edits[row.id] ?? {}) }));
  const rows = queues
    .filter((row: any) => team === "all" || String(row.team).toLowerCase() === team)
    .filter((row: any) => !breachedOnly || row.sla !== "green");
  const open = Math.max(0, rows.reduce((sum: number, row: any) => sum + Number(row.open), 0) - triaged);
  const breached = queues.filter((row: any) => row.sla !== "green").length;
  const handleCellChange = (change: any) => {
    const value = change.column === "open" ? Number(change.value) : change.value;
    setState({
      edits: {
        ...edits,
        [change.rowId]: { ...(edits[change.rowId] ?? {}), [change.column]: value }
      }
    });
  };
  return (
    <Section title="Support queue" description="Inbox widget with SLA focus controls">
      <Stack direction="horizontal" gap="sm">
        <Badge label="Inbox" tone="default" />
        <Badge label={breached + " breached"} tone={breached > 0 ? "danger" : "success"} />
        <Badge label={breachedOnly ? "Risk only" : "All queues"} tone={breachedOnly ? "warning" : "success"} />
      </Stack>
      <Stack direction="horizontal" gap="md">
        <MetricCard title="Open" value={open} delta={"-" + triaged + " triaged"} tone={open > 25 ? "warning" : "success"} />
        <MetricCard title="Reply" value={data.firstReply} delta="median" tone="default" />
      </Stack>
      <SegmentedControl
        label="Team"
        value={team}
        options={[{ label: "All", value: "all" }, { label: "Billing", value: "billing" }, { label: "Platform", value: "platform" }, { label: "Security", value: "security" }]}
        onChange={(next) => setState({ team: next })}
      />
      <ToggleSwitch label="SLA risk only" checked={breachedOnly} description="Hide green queues" onChange={(checked) => setState({ breachedOnly: checked })} />
      <StatList items={[
        { label: "Visible queues", value: rows.length, tone: rows.length > 0 ? "default" : "muted" },
        { label: "First reply", value: data.firstReply, tone: "success" },
        { label: "Breached", value: breached, tone: breached > 0 ? "danger" : "success" }
      ]} />
      <EditableTable columns={data.editableColumns} rows={rows} density="compact" onCellChange={handleCellChange} />
      <Notice title="SLA focus" message={rows.length === 0 ? "No queues match this filter." : "Edit owners and SLA state locally inside the widget."} tone={rows.length === 0 ? "success" : "warning"} />
      <ActionButton label="Triage 3" variant="primary" onClick={() => setState({ triaged: triaged + 3 })} />
    </Section>
  );
}
`,
  experiment: `import { Stack, Section, Badge, MetricCard, ProgressBar, SparkBars, Timeline, Notice, SegmentedControl, SliderControl } from "@widget/ui";
import type { WidgetComponentProps } from "@widget/ui";

type Props = WidgetComponentProps<Record<string, any>, Record<string, any>>;

export default function Widget({ state, setState, data }: Props) {
  const view = state.view ?? "summary";
  const threshold = state.threshold ?? 95;
  const ready = data.confidence >= threshold;
  return (
    <Section title="Experiment readout" description="App Store-style decision card">
      <Stack direction="horizontal" gap="sm">
        <Badge label="Variant B" tone="success" />
        <Badge label={data.confidence + "% confidence"} tone={ready ? "success" : "warning"} />
        <Badge label={ready ? "Ship" : "Hold"} tone={ready ? "success" : "warning"} />
      </Stack>
      <MetricCard title="Conversion lift" value={"+" + data.lift + "%"} delta="primary metric" tone="success" />
      <SegmentedControl label="Readout" value={view} options={[{ label: "Summary", value: "summary" }, { label: "Cohorts", value: "cohorts" }, { label: "Guardrails", value: "guardrails" }]} onChange={(next) => setState({ view: next })} />
      <ProgressBar label="Confidence" value={data.confidence} tone={ready ? "success" : "warning"} />
      <SliderControl label="Ship threshold" value={threshold} min={85} max={99} step={1} unit="%" onChange={(next) => setState({ threshold: next })} />
      {view !== "guardrails" && <SparkBars title="Cohort conversion" values={data.cohorts} tone="success" />}
      {view !== "cohorts" && <Timeline items={data.checkpoints} />}
      <Notice title="Decision" message={ready ? "Confidence clears the local ship threshold." : "Keep collecting weekday traffic before promotion."} tone={ready ? "success" : "warning"} />
    </Section>
  );
}
`,
  "infra-cost": `import { Stack, Section, Badge, MetricCard, ProgressBar, StatList, LineChart, ToggleSwitch, SliderControl, Notice } from "@widget/ui";
import type { WidgetComponentProps } from "@widget/ui";

type Props = WidgetComponentProps<Record<string, any>, Record<string, any>>;

export default function Widget({ state, setState, data }: Props) {
  const reserved = state.reserved ?? true;
  const cap = state.cap ?? 72;
  const adjustedSpend = Math.max(0, data.spend - (reserved ? 4200 : 0));
  const budgetUsed = Math.min(100, Math.round((data.budgetUsed + cap) / 2));
  return (
    <Section title="Infrastructure cost" description="Settings-style spend and budget controls">
      <Stack direction="horizontal" gap="sm">
        <Badge label="Cloud" tone="default" />
        <Badge label={data.delta} tone="success" />
        <Badge label={reserved ? "Reserved" : "On demand"} tone={reserved ? "success" : "warning"} />
      </Stack>
      <MetricCard title="Spend" value={"$" + Math.round(adjustedSpend / 1000) + "k"} delta={reserved ? "reservation applied" : "on demand"} tone={budgetUsed > 80 ? "warning" : "success"} />
      <ToggleSwitch label="Use reservations" checked={reserved} description="Apply committed-use discount in this widget" onChange={(checked) => setState({ reserved: checked })} />
      <SliderControl label="Budget cap" value={cap} min={55} max={95} step={1} unit="%" onChange={(next) => setState({ cap: next })} />
      <ProgressBar label="Budget used" value={budgetUsed} tone={budgetUsed > 80 ? "warning" : "success"} />
      <LineChart title="Daily spend trend" points={data.points.map((point: number) => reserved ? Math.max(0, point - 5) : point)} />
      <StatList items={data.drivers} />
      <Notice title="Optimization" message={reserved ? "Compute reservations are lowering today's run rate." : "Turn reservations back on to preview committed-use savings."} tone={reserved ? "success" : "warning"} />
    </Section>
  );
}
`,
  release: `import { Stack, Section, Badge, ProgressBar, Checklist, ActionButton, Notice, ToggleSwitch, StatList } from "@widget/ui";
import type { WidgetComponentProps } from "@widget/ui";

type Props = WidgetComponentProps<Record<string, any>, Record<string, any>>;

export default function Widget({ state, setState, data }: Props) {
  const manualApprovals = state.approvals ?? 0;
  const includeManual = state.includeManual ?? true;
  const completedChecks = data.checks.filter((item: any) => item.done).length;
  const pendingChecks = data.checks.length - completedChecks;
  const appliedApprovals = includeManual ? Math.min(pendingChecks, manualApprovals) : 0;
  const done = completedChecks + appliedApprovals;
  const total = data.checks.length;
  const progress = Math.min(100, Math.round((done / total) * 100));
  return (
    <Section title="Release Checklist" description={"Release " + data.release + " gate card"}>
      <Stack direction="horizontal" gap="sm">
        <Badge label="Release" tone="default" />
        <Badge label={progress + "% ready"} tone={progress >= 100 ? "success" : "warning"} />
        <Badge label={includeManual ? "Overrides on" : "Checks only"} tone={includeManual ? "warning" : "default"} />
      </Stack>
      <ProgressBar label="Readiness" value={progress} tone={progress >= 100 ? "success" : "warning"} />
      <StatList items={[
        { label: "Complete", value: done + "/" + total, tone: progress >= 100 ? "success" : "warning" },
        { label: "Manual approvals", value: appliedApprovals, tone: appliedApprovals > 0 ? "warning" : "muted" },
        { label: "Release", value: data.release, tone: "default" }
      ]} />
      <ToggleSwitch label="Include manual approvals" checked={includeManual} description="Reflect release manager overrides" onChange={(checked) => setState({ includeManual: checked })} />
      <Checklist items={data.checks} />
      <ActionButton label="Record approval" variant="primary" onClick={() => setState({ approvals: Math.min(total, manualApprovals + 1) })} />
      {progress >= 100 ? <Notice title="Ready" message="All gates are marked complete." tone="success" /> : <Notice title="Hold" message="Security and runbook gates still need owner signoff." tone="warning" />}
    </Section>
  );
}
`,
  regional: `import { Stack, Section, Badge, DataTable, StatList, ProgressBar, SegmentedControl, TextBlock } from "@widget/ui";
import type { WidgetComponentProps } from "@widget/ui";

type Props = WidgetComponentProps<Record<string, any>, Record<string, any>>;

export default function Widget({ state, setState, data }: Props) {
  const region = state.region ?? "all";
  const rows = data.rows.filter((row: any) => region === "all" || row.region === region);
  const selected = rows[0] ?? data.rows[0];
  const growth = Number.parseInt(String(selected.growth).replace("+", "").replace("%", ""), 10);
  return (
    <Section title="Regional performance" description="Maps-style market card">
      <Stack direction="horizontal" gap="sm">
        <Badge label="QTD" tone="default" />
        <Badge label={region === "all" ? "All regions" : selected.region} tone="success" />
        <Badge label={selected.growth + " growth"} tone="success" />
      </Stack>
      <SegmentedControl
        label="Region"
        value={region}
        options={[{ label: "All", value: "all" }, { label: "NA", value: "North America" }, { label: "EU", value: "Europe" }, { label: "APAC", value: "APAC" }]}
        onChange={(next) => setState({ region: next })}
      />
      <StatList items={[
        { label: "Revenue", value: selected.revenue, tone: "success" },
        { label: "Growth", value: selected.growth, tone: "success" },
        { label: "Rows", value: rows.length, tone: "default" }
      ]} />
      <ProgressBar label="Growth pulse" value={growth * 5} tone="success" />
      <DataTable columns={data.columns} rows={rows} />
      <TextBlock text={region === "all" ? "APAC is the fastest-moving region this quarter." : "Regional card is filtered locally."} tone="muted" />
    </Section>
  );
}
`,
  inventory: `import { Stack, Section, Badge, ProgressBar, EditableTable, Notice, SliderControl, ActionButton, ToggleSwitch, StatList } from "@widget/ui";
import type { WidgetComponentProps } from "@widget/ui";

type Props = WidgetComponentProps<Record<string, any>, Record<string, any>>;

export default function Widget({ state, setState, data }: Props) {
  const expedited = state.expedited ?? false;
  const compact = state.compact ?? true;
  const safetyStock = state.safetyStock ?? 12;
  const edits = state.edits ?? {};
  const inventoryRows = data.rows.map((row: any) => ({ ...row, ...(edits[row.id] ?? {}) }));
  const rows = compact ? inventoryRows.filter((row: any) => row.risk !== "low") : inventoryRows;
  const highRisk = inventoryRows.filter((row: any) => row.risk === "high").length;
  const adjustedFill = Math.max(0, data.fillRate - Math.max(0, safetyStock - 12) - (highRisk * 2) + (expedited ? 5 : 0));
  const handleCellChange = (change: any) => {
    const value = change.column === "days" ? Number(change.value) : change.value;
    setState({
      edits: {
        ...edits,
        [change.rowId]: { ...(edits[change.rowId] ?? {}), [change.column]: value }
      }
    });
  };
  return (
    <Section title="Inventory alerts" description="Supply widget with remediation controls">
      <Stack direction="horizontal" gap="sm">
        <Badge label="Supply" tone="default" />
        <Badge label={expedited ? "Expedited" : "Action needed"} tone={expedited ? "success" : "warning"} />
        <Badge label={rows.length + " alerts"} tone={rows.length > 0 ? "warning" : "success"} />
      </Stack>
      <ProgressBar label="Fill rate" value={adjustedFill} tone={adjustedFill > 90 ? "success" : "warning"} />
      <StatList items={[
        { label: "Safety stock", value: safetyStock + "d", tone: safetyStock > 18 ? "warning" : "default" },
        { label: "High risk", value: highRisk, tone: highRisk > 0 ? "danger" : "success" },
        { label: "Mode", value: compact ? "Alerts" : "All SKUs", tone: "default" }
      ]} />
      <ToggleSwitch label="Alerts only" checked={compact} description="Hide low-risk inventory rows" onChange={(checked) => setState({ compact: checked })} />
      <SliderControl label="Safety stock" value={safetyStock} min={6} max={24} step={1} unit="d" onChange={(next) => setState({ safetyStock: next })} />
      <EditableTable columns={data.editableColumns} rows={rows} density="compact" onCellChange={handleCellChange} />
      <Notice title="Risk" message={expedited ? "Core-XL has an expedited replenishment marker." : "Edit days and risk to preview replenishment impact."} tone={expedited ? "success" : "warning"} />
      <ActionButton label="Mark expedited" variant="primary" onClick={() => setState({ expedited: true })} />
    </Section>
  );
}
`,
  eng: `import { Stack, Section, Badge, MetricCard, SparkBars, Timeline, StatList, SegmentedControl, ToggleSwitch, Notice } from "@widget/ui";
import type { WidgetComponentProps } from "@widget/ui";

type Props = WidgetComponentProps<Record<string, any>, Record<string, any>>;

export default function Widget({ state, setState, data }: Props) {
  const focus = state.focus ?? "ship";
  const quiet = state.quiet ?? false;
  const deploys = quiet ? data.deploys.map((value: number) => Math.max(0, value - 1)) : data.deploys;
  const totalDeploys = deploys.reduce((sum: number, value: number) => sum + value, 0);
  return (
    <Section title="Engineering flow" description="Activity-style delivery glance">
      <Stack direction="horizontal" gap="sm">
        <Badge label={focus === "ship" ? "Shipping" : focus === "review" ? "Review" : "Risk"} tone={focus === "risk" ? "warning" : "success"} />
        <Badge label={quiet ? "Quiet hours" : "Live"} tone={quiet ? "default" : "success"} />
      </Stack>
      <SegmentedControl
        label="Focus"
        value={focus}
        options={[{ label: "Ship", value: "ship" }, { label: "Review", value: "review" }, { label: "Risk", value: "risk" }]}
        onChange={(next) => setState({ focus: next })}
      />
      <ToggleSwitch label="Quiet hours" checked={quiet} description="Preview reduced deployment cadence" onChange={(checked) => setState({ quiet: checked })} />
      <Stack direction="horizontal" gap="md">
        <MetricCard title="Merged" value={data.merged} delta="7d" tone="success" />
        <MetricCard title="Review age" value={data.reviewAge} delta="median" tone={focus === "review" ? "warning" : "default"} />
      </Stack>
      <SparkBars title="Deploy activity" values={deploys} tone={focus === "risk" ? "warning" : "success"} />
      <StatList items={[
        { label: "Deploys", value: totalDeploys, tone: "success" },
        { label: "Build pass rate", value: "97%", tone: "success" },
        { label: "Rollback risk", value: focus === "risk" ? "medium" : "low", tone: focus === "risk" ? "warning" : "success" }
      ]} />
      <Timeline items={data.blockers} />
      <Notice title="Flow" message={focus === "risk" ? "Watch migration dry run and mobile QA before next deploy." : "Delivery signal is healthy across the current window."} tone={focus === "risk" ? "warning" : "success"} />
    </Section>
  );
}
`,
};

export function sourceForWidget(widgetId: string): string {
  if (seedSources[widgetId]) return seedSources[widgetId];
  const baseId = widgetId.replace(/-[a-z0-9]+$/i, "");
  return seedSources[baseId] ?? seedSources["counter"] ?? "";
}
