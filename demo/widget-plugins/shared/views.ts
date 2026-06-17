import { callback, createViews, passthrough, view } from "@playfast/echoform";
import { z } from "zod";
import type {
  BundleRequest,
  BundleResult,
  ReorderRequest,
  SourceChangeRequest,
  WidgetDescriptor,
  WidgetStatus,
} from "./plugin-types";

export const DashboardApp = view("DashboardApp", {
  input: {
    title: z.string(),
    selectedWidgetId: z.string().nullable(),
  },
  callbacks: {
    onSelectWidget: callback({ input: z.string() }),
  },
});

export const RuntimeStatus = view("RuntimeStatus", {
  input: {
    workerCount: z.number(),
    runningCount: z.number(),
    errorCount: z.number(),
  },
});

export const WidgetGrid = view("WidgetGrid", {
  input: {
    widgets: passthrough<readonly WidgetDescriptor[]>(),
    selectedWidgetId: z.string().nullable(),
  },
  callbacks: {
    onReorder: callback({ input: passthrough<ReorderRequest>() }),
    onSelectWidget: callback({ input: z.string() }),
  },
});

export const WidgetFrame = view("WidgetFrame", {
  input: {
    widget: passthrough<WidgetDescriptor>(),
    selected: z.boolean(),
    status: passthrough<WidgetStatus>(),
    error: z.string().nullable(),
  },
  callbacks: {
    onSelectWidget: callback({ input: z.string() }),
    onDuplicate: callback({ input: z.string() }),
    onRemove: callback({ input: z.string() }),
    onBundle: callback({
      input: passthrough<BundleRequest>(),
      output: passthrough<BundleResult>(),
    }),
  },
});

export const PluginEditor = view("PluginEditor", {
  input: {
    widgetId: z.string().nullable(),
    source: z.string(),
    bundleError: z.string().nullable(),
  },
  callbacks: {
    onSourceChange: callback({ input: passthrough<SourceChangeRequest>() }),
    onBundle: callback({
      input: passthrough<BundleRequest>(),
      output: passthrough<BundleResult>(),
    }),
  },
});

export const ErrorPanel = view("ErrorPanel", {
  input: { message: z.string() },
  callbacks: { onDismiss: callback() },
});

export const Stack = view("Stack", {
  input: {
    direction: z.enum(["vertical", "horizontal"]).default("vertical"),
    gap: z.enum(["sm", "md", "lg"]).default("md"),
  },
});

export const Section = view("Section", {
  input: {
    title: z.string(),
    description: z.string().nullable().default(null),
  },
});

export const TextBlock = view("TextBlock", {
  input: {
    text: z.string(),
    tone: z.enum(["default", "muted", "success", "warning", "danger"]).default("default"),
  },
});

export const Badge = view("Badge", {
  input: {
    label: z.string(),
    tone: z.enum(["default", "muted", "success", "warning", "danger"]).default("default"),
  },
});

export const MetricCard = view("MetricCard", {
  input: {
    title: z.string(),
    value: z.union([z.string(), z.number()]),
    delta: z.string().nullable().default(null),
    tone: z.enum(["default", "success", "warning", "danger"]).default("default"),
  },
});

export const ProgressBar = view("ProgressBar", {
  input: {
    label: z.string(),
    value: z.number(),
    max: z.number().default(100),
    tone: z.enum(["default", "success", "warning", "danger"]).default("default"),
  },
});

export const StatList = view("StatList", {
  input: {
    items: passthrough<readonly {
      readonly label: string;
      readonly value: string | number;
      readonly tone?: "default" | "muted" | "success" | "warning" | "danger";
    }[]>(),
  },
});

export const LineChart = view("LineChart", {
  input: {
    title: z.string(),
    points: passthrough<readonly number[]>(),
  },
});

export const SparkBars = view("SparkBars", {
  input: {
    title: z.string(),
    values: passthrough<readonly number[]>(),
    tone: z.enum(["default", "success", "warning", "danger"]).default("default"),
  },
});

export const DataTable = view("DataTable", {
  input: {
    columns: passthrough<readonly string[]>(),
    rows: passthrough<readonly Readonly<Record<string, string | number | boolean | null>>[]>(),
  },
});

export const EditableTable = view("EditableTable", {
  input: {
    columns: passthrough<readonly {
      readonly key: string;
      readonly label: string;
      readonly kind?: "text" | "number" | "select" | "badge";
      readonly options?: readonly {
        readonly label: string;
        readonly value: string;
      }[];
      readonly suffix?: string | null;
    }[]>(),
    rows: passthrough<readonly Readonly<Record<string, string | number | boolean | null>>[]>(),
    rowIdKey: z.string().default("id"),
    density: z.enum(["compact", "regular"]).default("regular"),
  },
  callbacks: {
    onCellChange: callback({
      input: passthrough<{
        readonly rowId: string;
        readonly column: string;
        readonly value: string | number | boolean | null;
      }>(),
    }),
  },
});

export const Timeline = view("Timeline", {
  input: {
    items: passthrough<readonly {
      readonly title: string;
      readonly meta?: string | null;
      readonly tone?: "default" | "muted" | "success" | "warning" | "danger";
    }[]>(),
  },
});

export const Notice = view("Notice", {
  input: {
    title: z.string(),
    message: z.string(),
    tone: z.enum(["default", "success", "warning", "danger"]).default("default"),
  },
});

export const Checklist = view("Checklist", {
  input: {
    items: passthrough<readonly {
      readonly label: string;
      readonly done: boolean;
      readonly detail?: string | null;
    }[]>(),
  },
});

export const SegmentedControl = view("SegmentedControl", {
  input: {
    label: z.string(),
    value: z.string(),
    options: passthrough<readonly {
      readonly label: string;
      readonly value: string;
    }[]>(),
  },
  callbacks: {
    onChange: callback({ input: z.string() }),
  },
});

export const ToggleSwitch = view("ToggleSwitch", {
  input: {
    label: z.string(),
    checked: z.boolean(),
    description: z.string().nullable().default(null),
  },
  callbacks: {
    onChange: callback({ input: z.boolean() }),
  },
});

export const SliderControl = view("SliderControl", {
  input: {
    label: z.string(),
    value: z.number(),
    min: z.number().default(0),
    max: z.number().default(100),
    step: z.number().default(1),
    unit: z.string().nullable().default(null),
  },
  callbacks: {
    onChange: callback({ input: z.number() }),
  },
});

export const ActionButton = view("ActionButton", {
  input: {
    label: z.string(),
    variant: z.enum(["primary", "secondary", "danger"]).default("primary"),
  },
  callbacks: {
    onClick: callback(),
  },
});

export const dashboardViews = createViews({
  DashboardApp,
  RuntimeStatus,
  WidgetGrid,
  WidgetFrame,
  PluginEditor,
  ErrorPanel,
});

export const pluginViews = createViews({
  Stack,
  Section,
  TextBlock,
  Badge,
  MetricCard,
  ProgressBar,
  StatList,
  LineChart,
  SparkBars,
  DataTable,
  EditableTable,
  Timeline,
  Notice,
  Checklist,
  SegmentedControl,
  ToggleSwitch,
  SliderControl,
  ActionButton,
});
