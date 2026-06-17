import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useId,
  type ReactNode,
} from "react";
import * as monaco from "monaco-editor/esm/vs/editor/editor.main.js";
import { ViewsRenderer, type SerializableValue } from "@playfast/echoform";
import type { InferClientProps } from "@playfast/echoform/client";
import type {
  ActionButton as ActionButtonDef,
  Badge as BadgeDef,
  Checklist as ChecklistDef,
  DashboardApp as DashboardAppDef,
  DataTable as DataTableDef,
  EditableTable as EditableTableDef,
  ErrorPanel as ErrorPanelDef,
  LineChart as LineChartDef,
  MetricCard as MetricCardDef,
  Notice as NoticeDef,
  PluginEditor as PluginEditorDef,
  ProgressBar as ProgressBarDef,
  Section as SectionDef,
  SegmentedControl as SegmentedControlDef,
  SliderControl as SliderControlDef,
  SparkBars as SparkBarsDef,
  RuntimeStatus as RuntimeStatusDef,
  Stack as StackDef,
  StatList as StatListDef,
  TextBlock as TextBlockDef,
  Timeline as TimelineDef,
  ToggleSwitch as ToggleSwitchDef,
  WidgetFrame as WidgetFrameDef,
  WidgetGrid as WidgetGridDef,
} from "../shared/views";
import type { BundleRequest, BundleResult, JsonObject, PluginLog, RenderedWidget, WidgetDescriptor, WidgetStatus } from "../shared/plugin-types";
import { PluginWorkerPool } from "./plugin-runtime/PluginWorkerPool";
import { loadStoredState, saveStoredState, type StoredDashboardState } from "./plugin-runtime/storage";
import { sourceForWidget } from "./plugin-runtime/seed-plugins";

interface RuntimeWidgetState {
  readonly source: string;
  readonly status: WidgetStatus;
  readonly error: string | null;
  readonly bundleError: string | null;
  readonly views: RenderedWidget["views"];
  readonly state: JsonObject;
  readonly version: number;
  readonly logs: readonly PluginLog[];
}

interface RuntimeContextValue {
  readonly workerCount: number;
  readonly runningCount: number;
  readonly errorCount: number;
  readonly selectedWidgetId: string | null;
  readonly storedSelectedWidgetId: string | null;
  readonly widgetOrder: readonly string[];
  readonly setSelectedWidgetId: (widgetId: string | null) => void;
  readonly rememberWidgets: (widgets: readonly WidgetDescriptor[]) => void;
  readonly setWidgetOrder: (order: readonly string[]) => void;
  readonly getWidgetState: (widgetId: string) => RuntimeWidgetState;
  readonly updateSource: (widgetId: string, source: string) => void;
  readonly runWidget: (
    widget: WidgetDescriptor,
    bundle: (request: BundleRequest) => Promise<BundleResult>,
  ) => Promise<void>;
  readonly runWidgetById: (
    widgetId: string,
    bundle: (request: BundleRequest) => Promise<BundleResult>,
  ) => Promise<void>;
  readonly invokeWidgetEvent: (
    widgetId: string,
    eventUid: Parameters<NonNullable<React.ComponentProps<typeof ViewsRenderer>["createEvent"]>>[0],
    args: readonly SerializableValue[],
  ) => Promise<SerializableValue>;
  readonly disposeWidget: (widgetId: string) => void;
}

const RuntimeContext = createContext<RuntimeContextValue | null>(null);

declare global {
  interface Window {
    __widgetPluginDemo?: {
      readonly setSource: (source: string) => void;
      readonly getSource: () => string;
    };
  }
}

interface GridDragContextValue {
  readonly activeId: string | null;
  readonly overId: string | null;
  readonly onDragStart: (widgetId: string, event: React.DragEvent) => void;
  readonly onDragEnter: (widgetId: string) => void;
  readonly onDragOver: (event: React.DragEvent) => void;
  readonly onDrop: (widgetId: string) => void;
  readonly onDragEnd: () => void;
  readonly moveWidgetByOffset: (widgetId: string, offset: -1 | 1) => void;
  readonly moveWidgetToEdge: (widgetId: string, edge: "start" | "end") => void;
}

const GridDragContext = createContext<GridDragContextValue | null>(null);

interface DevModeContextValue {
  readonly enabled: boolean;
  readonly setEnabled: (enabled: boolean) => void;
}

const DevModeContext = createContext<DevModeContextValue | null>(null);

function useRuntime(): RuntimeContextValue {
  const context = useContext(RuntimeContext);
  if (!context) throw new Error("Widget plugin runtime context is missing.");
  return context;
}

function useDevMode(): DevModeContextValue {
  const context = useContext(DevModeContext);
  if (!context) throw new Error("Dev mode context is missing.");
  return context;
}

function createInitialWidgetState(widgetId: string, stored: StoredDashboardState): RuntimeWidgetState {
  return {
    source: stored.widgetSources[widgetId] ?? sourceForWidget(widgetId),
    status: "idle",
    error: null,
    bundleError: null,
    views: [],
    state: stored.widgetStates[widgetId] ?? {},
    version: 0,
    logs: [],
  };
}

function nextWidgetState(
  current: Readonly<Record<string, RuntimeWidgetState>>,
  widgetId: string,
  stored: StoredDashboardState,
): RuntimeWidgetState {
  return current[widgetId] ?? createInitialWidgetState(widgetId, stored);
}

function stateForStorage(
  widgetStates: Readonly<Record<string, RuntimeWidgetState>>,
  widgetOrder: readonly string[],
  selectedWidgetId: string | null,
): StoredDashboardState {
  const widgetSources: Record<string, string> = {};
  const storedStates: Record<string, JsonObject> = {};

  for (const [widgetId, state] of Object.entries(widgetStates)) {
    widgetSources[widgetId] = state.source;
    storedStates[widgetId] = state.state;
  }

  return {
    widgetOrder,
    selectedWidgetId,
    widgetSources,
    widgetStates: storedStates,
  };
}

export function PluginRuntimeProvider({ children }: { readonly children: ReactNode }): React.ReactElement {
  const storedRef = useRef(loadStoredState());
  const [widgetStates, setWidgetStates] = useState<Readonly<Record<string, RuntimeWidgetState>>>({});
  const [widgetOrder, setWidgetOrderState] = useState<readonly string[]>(storedRef.current.widgetOrder);
  const [selectedWidgetId, setSelectedWidgetIdState] = useState<string | null>(storedRef.current.selectedWidgetId);
  const [descriptors, setDescriptors] = useState<Readonly<Record<string, WidgetDescriptor>>>({});
  const poolRef = useRef<PluginWorkerPool | null>(null);
  const selectedRef = useRef(selectedWidgetId);
  selectedRef.current = selectedWidgetId;

  const setWidgetPatch = useCallback((widgetId: string, patch: Partial<RuntimeWidgetState>) => {
    setWidgetStates((current) => {
      const existing = nextWidgetState(current, widgetId, storedRef.current);
      return {
        ...current,
        [widgetId]: { ...existing, ...patch },
      };
    });
  }, []);

  useEffect(() => {
    poolRef.current = new PluginWorkerPool({
      onLog: (log) => {
        setWidgetStates((current) => {
          const existing = nextWidgetState(current, log.widgetId, storedRef.current);
          return {
            ...current,
            [log.widgetId]: {
              ...existing,
              logs: [...existing.logs.slice(-30), log],
            },
          };
        });
      },
      onStatus: (status) => {
        const mappedStatus: WidgetStatus = status.status === "error" ? "error" : status.status === "running" ? "running" : "idle";
        setWidgetPatch(status.widgetId, { status: mappedStatus });
      },
      onWorkerError: (widgetIds, error) => {
        for (const widgetId of widgetIds) {
          setWidgetPatch(widgetId, { status: "error", error });
        }
      },
    });

    return () => {
      poolRef.current?.destroy();
      poolRef.current = null;
    };
  }, [setWidgetPatch]);

  useEffect(() => {
    saveStoredState(stateForStorage(widgetStates, widgetOrder, selectedWidgetId));
  }, [selectedWidgetId, widgetOrder, widgetStates]);

  const rememberWidgets = useCallback((widgets: readonly WidgetDescriptor[]) => {
    setDescriptors((current) => {
      const next: Record<string, WidgetDescriptor> = { ...current };
      for (const widget of widgets) next[widget.id] = widget;
      return next;
    });

    setWidgetStates((current) => {
      const next: Record<string, RuntimeWidgetState> = { ...current };
      for (const widget of widgets) {
        next[widget.id] = nextWidgetState(current, widget.id, storedRef.current);
      }
      return next;
    });
  }, []);

  const getWidgetState = useCallback(
    (widgetId: string) => nextWidgetState(widgetStates, widgetId, storedRef.current),
    [widgetStates],
  );

  const updateSource = useCallback((widgetId: string, source: string) => {
    setWidgetPatch(widgetId, { source, bundleError: null });
  }, [setWidgetPatch]);

  const applyWorkerResult = useCallback((result: Awaited<ReturnType<PluginWorkerPool["loadPlugin"]>>) => {
    if (result.ok) {
      setWidgetPatch(result.widgetId, {
        status: "running",
        error: null,
        bundleError: null,
        views: result.views,
        state: result.state,
      });
      return;
    }
    setWidgetPatch(result.widgetId, {
      status: "error",
      error: `${result.phase}: ${result.error}`,
    });
  }, [setWidgetPatch]);

  const runWidget = useCallback(
    async (widget: WidgetDescriptor, bundle: (request: BundleRequest) => Promise<BundleResult>) => {
      const current = getWidgetState(widget.id);
      setWidgetPatch(widget.id, { status: "bundling", error: null, bundleError: null });
      const bundleResult = await bundle({ widgetId: widget.id, source: current.source });
      if (!bundleResult.ok) {
        setWidgetPatch(widget.id, { status: "error", bundleError: bundleResult.error, error: bundleResult.error });
        return;
      }

      const version = current.version + 1;
      setWidgetPatch(widget.id, { version, status: "running" });
      const result = await poolRef.current?.loadPlugin({
        widgetId: widget.id,
        version,
        code: bundleResult.code,
        data: widget.data,
        initialState: current.state,
      });
      if (result) applyWorkerResult(result);
    },
    [applyWorkerResult, getWidgetState, setWidgetPatch],
  );

  const runWidgetById = useCallback(
    async (widgetId: string, bundle: (request: BundleRequest) => Promise<BundleResult>) => {
      const widget = descriptors[widgetId];
      if (!widget) {
        setWidgetPatch(widgetId, { status: "error", error: "Unknown widget descriptor." });
        return;
      }
      await runWidget(widget, bundle);
    },
    [descriptors, runWidget, setWidgetPatch],
  );

  const invokeWidgetEvent = useCallback(
    async (
      widgetId: string,
      eventUid: Parameters<NonNullable<React.ComponentProps<typeof ViewsRenderer>["createEvent"]>>[0],
      args: readonly SerializableValue[],
    ): Promise<SerializableValue> => {
      const result = await poolRef.current?.invokeEvent({ widgetId, eventUid, args });
      if (result) applyWorkerResult(result);
      return undefined;
    },
    [applyWorkerResult],
  );

  const disposeWidget = useCallback((widgetId: string) => {
    poolRef.current?.disposePlugin(widgetId);
    setWidgetStates((current) => {
      const next = { ...current };
      delete next[widgetId];
      return next;
    });
  }, []);

  const setWidgetOrder = useCallback((order: readonly string[]) => {
    setWidgetOrderState(order);
  }, []);

  const setSelectedWidgetId = useCallback((widgetId: string | null) => {
    setSelectedWidgetIdState(widgetId);
  }, []);

  const value = useMemo<RuntimeContextValue>(() => {
    const states = Object.values(widgetStates);
    return {
      workerCount: poolRef.current?.workerCount ?? 0,
      runningCount: states.filter((state) => state.status === "running").length,
      errorCount: states.filter((state) => state.status === "error").length,
      selectedWidgetId,
      storedSelectedWidgetId: storedRef.current.selectedWidgetId,
      widgetOrder,
      setSelectedWidgetId,
      rememberWidgets,
      setWidgetOrder,
      getWidgetState,
      updateSource,
      runWidget,
      runWidgetById,
      invokeWidgetEvent,
      disposeWidget,
    };
  }, [
    disposeWidget,
    getWidgetState,
    invokeWidgetEvent,
    rememberWidgets,
    runWidget,
    runWidgetById,
    selectedWidgetId,
    setSelectedWidgetId,
    setWidgetOrder,
    updateSource,
    widgetOrder,
    widgetStates,
  ]);

  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>;
}

export function DashboardApp({ title, selectedWidgetId, onSelectWidget, children }: InferClientProps<typeof DashboardAppDef>): React.ReactElement {
  const { setSelectedWidgetId, storedSelectedWidgetId } = useRuntime();
  const didRestoreSelection = useRef(false);
  const [devMode, setDevMode] = useState(false);
  const devModeValue = useMemo<DevModeContextValue>(() => ({
    enabled: devMode,
    setEnabled: setDevMode,
  }), [devMode]);

  useEffect(() => {
    setSelectedWidgetId(selectedWidgetId);
  }, [selectedWidgetId, setSelectedWidgetId]);

  useEffect(() => {
    if (didRestoreSelection.current || !storedSelectedWidgetId) return;
    didRestoreSelection.current = true;
    onSelectWidget.mutate(storedSelectedWidgetId);
  }, [onSelectWidget, storedSelectedWidgetId]);

  return (
    <DevModeContext.Provider value={devModeValue}>
      <div className="app-shell">
        <header className="topbar">
          <div>
            <h1>{title}</h1>
            <p>Generated TSX widgets rendered through host-owned Echoform UI views.</p>
          </div>
          <button
            type="button"
            className={`mode-toggle ${devMode ? "is-active" : ""}`}
            aria-pressed={devMode}
            onClick={() => setDevMode((current) => !current)}
          >
            {devMode ? "Live Mode" : "Dev Mode"}
          </button>
        </header>
        <main className={`workspace ${devMode ? "is-dev-mode" : "is-live-mode"}`}>{children}</main>
      </div>
    </DevModeContext.Provider>
  );
}

export function RuntimeStatus(_props: InferClientProps<typeof RuntimeStatusDef>): React.ReactElement {
  const runtime = useRuntime();
  return (
    <section className="runtime-status" aria-label="Runtime status">
      <span>{runtime.workerCount} workers</span>
      <span>{runtime.runningCount} running</span>
      <span>{runtime.errorCount} errors</span>
    </section>
  );
}

export function ErrorPanel({ message, onDismiss }: InferClientProps<typeof ErrorPanelDef>): React.ReactElement {
  return (
    <div className="error-panel">
      <span>{message}</span>
      <button type="button" onClick={() => onDismiss.mutate()}>Dismiss</button>
    </div>
  );
}

function orderedWidgetIds(widgets: readonly WidgetDescriptor[], storedOrder: readonly string[]): readonly string[] {
  const visibleIds = new Set(widgets.map((widget) => widget.id));
  const ordered = storedOrder.filter((id) => visibleIds.has(id));
  for (const widget of widgets) {
    if (!ordered.includes(widget.id)) ordered.push(widget.id);
  }
  return ordered;
}

function reorderedWidgetIds(order: readonly string[], activeId: string, overId: string): readonly string[] {
  if (activeId === overId) return order;
  const fromIndex = order.indexOf(activeId);
  const toIndex = order.indexOf(overId);
  if (fromIndex < 0 || toIndex < 0) return order;
  const next = [...order];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return order;
  next.splice(toIndex, 0, moved);
  return next;
}

export function WidgetGrid({ widgets, selectedWidgetId, onReorder, children }: InferClientProps<typeof WidgetGridDef>): React.ReactElement {
  const { rememberWidgets, setWidgetOrder, widgetOrder } = useRuntime();
  const dragIdRef = useRef<string | null>(null);
  const [dragState, setDragState] = useState<{ readonly activeId: string | null; readonly overId: string | null }>({
    activeId: null,
    overId: null,
  });

  useEffect(() => {
    rememberWidgets(widgets);
  }, [rememberWidgets, widgets]);

  const order = orderedWidgetIds(widgets, widgetOrder);
  const childrenById = new Map<string, ReactNode>();
  for (const child of React.Children.toArray(children)) {
    if (React.isValidElement<{ readonly widget?: WidgetDescriptor }>(child) && child.props.widget) {
      childrenById.set(child.props.widget.id, child);
    }
  }

  const commitReorder = useCallback((activeId: string, overId: string) => {
    const nextOrder = reorderedWidgetIds(order, activeId, overId);
    if (nextOrder === order) return;
    setWidgetOrder(nextOrder);
    onReorder.mutate({ activeId, overId });
  }, [onReorder, order, setWidgetOrder]);

  const dragContext = useMemo<GridDragContextValue>(() => ({
    activeId: dragState.activeId,
    overId: dragState.overId,
    onDragStart: (widgetId, event) => {
      dragIdRef.current = widgetId;
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", widgetId);
      }
      setDragState({ activeId: widgetId, overId: null });
    },
    onDragEnter: (widgetId) => {
      const activeId = dragIdRef.current;
      if (!activeId || activeId === widgetId) return;
      setDragState({ activeId, overId: widgetId });
    },
    onDragOver: (event) => {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
    },
    onDrop: (overId) => {
      const activeId = dragIdRef.current;
      dragIdRef.current = null;
      setDragState({ activeId: null, overId: null });
      if (!activeId || activeId === overId) return;
      commitReorder(activeId, overId);
    },
    onDragEnd: () => {
      dragIdRef.current = null;
      setDragState({ activeId: null, overId: null });
    },
    moveWidgetByOffset: (widgetId, offset) => {
      const currentIndex = order.indexOf(widgetId);
      const targetId = order[currentIndex + offset];
      if (!targetId) return;
      commitReorder(widgetId, targetId);
    },
    moveWidgetToEdge: (widgetId, edge) => {
      const targetId = edge === "start" ? order[0] : order[order.length - 1];
      if (!targetId || targetId === widgetId) return;
      commitReorder(widgetId, targetId);
    },
  }), [commitReorder, dragState.activeId, dragState.overId, order]);

  return (
    <GridDragContext.Provider value={dragContext}>
      <section className="grid-panel">
        <div className="grid-heading">
          <div>
            <h2>Widget Grid</h2>
            <span>{widgets.length} generated widgets</span>
          </div>
          <div className="grid-density">
            <span>{dragState.activeId ? "Sorting" : "Ready"}</span>
          </div>
        </div>
        <div className={`widget-grid ${dragState.activeId ? "is-sorting" : ""}`} data-selected={selectedWidgetId ?? ""}>
          {order.map((widgetId) => childrenById.get(widgetId)).filter(Boolean)}
        </div>
      </section>
    </GridDragContext.Provider>
  );
}

const pluginUiComponents = {
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
};

const widgetUiTypeDefinitions = `
declare namespace JSX {
  interface Element {}
  interface IntrinsicElements {}
}

declare module "@widget/ui" {
  type WidgetElement = JSX.Element;
  type WidgetChild =
    | WidgetElement
    | string
    | number
    | boolean
    | null
    | undefined
    | readonly WidgetChild[];

  interface BaseProps {
    readonly children?: WidgetChild | readonly WidgetChild[];
  }

  export interface WidgetComponentProps<TState extends Record<string, unknown> = Record<string, unknown>, TData extends Record<string, unknown> = Record<string, unknown>> {
    readonly state: TState;
    readonly setState: (nextState: Partial<TState> | Record<string, unknown>) => void;
    readonly data: TData;
  }

  export interface StackProps extends BaseProps {
    readonly direction?: "vertical" | "horizontal";
    readonly gap?: "sm" | "md" | "lg";
  }

  export interface SectionProps extends BaseProps {
    readonly title: string;
    readonly description?: string | null;
  }

  export interface TextBlockProps {
    readonly text: string;
    readonly tone?: "default" | "muted" | "success" | "warning" | "danger";
  }

  export interface BadgeProps {
    readonly label: string;
    readonly tone?: "default" | "muted" | "success" | "warning" | "danger";
  }

  export interface MetricCardProps {
    readonly title: string;
    readonly value: string | number;
    readonly delta?: string | null;
    readonly tone?: "default" | "success" | "warning" | "danger";
  }

  export interface ProgressBarProps {
    readonly label: string;
    readonly value: number;
    readonly max?: number;
    readonly tone?: "default" | "success" | "warning" | "danger";
  }

  export interface StatListItem {
    readonly label: string;
    readonly value: string | number;
    readonly tone?: "default" | "muted" | "success" | "warning" | "danger";
  }

  export interface StatListProps {
    readonly items: readonly StatListItem[];
  }

  export interface LineChartProps {
    readonly title: string;
    readonly points: readonly number[];
  }

  export interface SparkBarsProps {
    readonly title: string;
    readonly values: readonly number[];
    readonly tone?: "default" | "success" | "warning" | "danger";
  }

  export interface DataTableProps {
    readonly columns: readonly string[];
    readonly rows: readonly Record<string, string | number | boolean | null>[];
  }

  export interface EditableTableColumnOption {
    readonly label: string;
    readonly value: string;
  }

  export interface EditableTableColumn {
    readonly key: string;
    readonly label: string;
    readonly kind?: "text" | "number" | "select" | "badge";
    readonly options?: readonly EditableTableColumnOption[];
    readonly suffix?: string | null;
  }

  export interface EditableTableCellChange {
    readonly rowId: string;
    readonly column: string;
    readonly value: string | number | boolean | null;
  }

  export interface EditableTableProps {
    readonly columns: readonly EditableTableColumn[];
    readonly rows: readonly Record<string, string | number | boolean | null>[];
    readonly rowIdKey?: string;
    readonly density?: "compact" | "regular";
    readonly onCellChange: (change: EditableTableCellChange) => void;
  }

  export interface TimelineItem {
    readonly title: string;
    readonly meta?: string | null;
    readonly tone?: "default" | "muted" | "success" | "warning" | "danger";
  }

  export interface TimelineProps {
    readonly items: readonly TimelineItem[];
  }

  export interface NoticeProps {
    readonly title: string;
    readonly message: string;
    readonly tone?: "default" | "success" | "warning" | "danger";
  }

  export interface ChecklistItem {
    readonly label: string;
    readonly done: boolean;
    readonly detail?: string | null;
  }

  export interface ChecklistProps {
    readonly items: readonly ChecklistItem[];
  }

  export interface SegmentedControlOption {
    readonly label: string;
    readonly value: string;
  }

  export interface SegmentedControlProps {
    readonly label: string;
    readonly value: string;
    readonly options: readonly SegmentedControlOption[];
    readonly onChange: (value: string) => void;
  }

  export interface ToggleSwitchProps {
    readonly label: string;
    readonly checked: boolean;
    readonly description?: string | null;
    readonly onChange: (checked: boolean) => void;
  }

  export interface SliderControlProps {
    readonly label: string;
    readonly value: number;
    readonly min?: number;
    readonly max?: number;
    readonly step?: number;
    readonly unit?: string | null;
    readonly onChange: (value: number) => void;
  }

  export interface ActionButtonProps {
    readonly label: string;
    readonly variant?: "primary" | "secondary" | "danger";
    readonly onClick?: () => void;
  }

  export function Stack(props: StackProps): WidgetElement;
  export function Section(props: SectionProps): WidgetElement;
  export function TextBlock(props: TextBlockProps): WidgetElement;
  export function Badge(props: BadgeProps): WidgetElement;
  export function MetricCard(props: MetricCardProps): WidgetElement;
  export function ProgressBar(props: ProgressBarProps): WidgetElement;
  export function StatList(props: StatListProps): WidgetElement;
  export function LineChart(props: LineChartProps): WidgetElement;
  export function SparkBars(props: SparkBarsProps): WidgetElement;
  export function DataTable(props: DataTableProps): WidgetElement;
  export function EditableTable(props: EditableTableProps): WidgetElement;
  export function Timeline(props: TimelineProps): WidgetElement;
  export function Notice(props: NoticeProps): WidgetElement;
  export function Checklist(props: ChecklistProps): WidgetElement;
  export function SegmentedControl(props: SegmentedControlProps): WidgetElement;
  export function ToggleSwitch(props: ToggleSwitchProps): WidgetElement;
  export function SliderControl(props: SliderControlProps): WidgetElement;
  export function ActionButton(props: ActionButtonProps): WidgetElement;
}
`;

let monacoTypeScriptConfigured = false;

function configureMonacoTypeScript(): void {
  if (monacoTypeScriptConfigured) return;
  monacoTypeScriptConfigured = true;

  const compilerOptions = {
    allowNonTsExtensions: true,
    allowSyntheticDefaultImports: true,
    esModuleInterop: true,
    jsx: monaco.typescript.JsxEmit.Preserve,
    module: monaco.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.typescript.ModuleResolutionKind.NodeJs,
    noEmit: true,
    strict: true,
    target: monaco.typescript.ScriptTarget.ES2020,
  };

  monaco.typescript.typescriptDefaults.setCompilerOptions(compilerOptions);
  monaco.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
  });
  monaco.typescript.typescriptDefaults.addExtraLib(
    widgetUiTypeDefinitions,
    "file:///node_modules/@widget/ui/index.d.ts",
  );
}

export function WidgetFrame({
  widget,
  selected,
  onSelectWidget,
  onDuplicate,
  onRemove,
  onBundle,
}: InferClientProps<typeof WidgetFrameDef>): React.ReactElement {
  const runtime = useRuntime();
  const dragContext = useContext(GridDragContext);
  const state = runtime.getWidgetState(widget.id);
  const autoRunRef = useRef(false);
  const layout = widget.layout ?? "standard";
  const isDragging = dragContext?.activeId === widget.id;
  const isDropTarget = dragContext?.overId === widget.id;

  useEffect(() => {
    if (autoRunRef.current) return;
    autoRunRef.current = true;
    runtime.runWidget(widget, onBundle.mutate);
  }, [onBundle.mutate, runtime, widget]);

  const run = (): void => {
    runtime.runWidget(widget, onBundle.mutate);
  };

  const remove = (): void => {
    runtime.disposeWidget(widget.id);
    onRemove.mutate(widget.id);
  };

  const handleDragKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (!dragContext) return;
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      event.stopPropagation();
      dragContext.moveWidgetByOffset(widget.id, -1);
    } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      event.stopPropagation();
      dragContext.moveWidgetByOffset(widget.id, 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      event.stopPropagation();
      dragContext.moveWidgetToEdge(widget.id, "start");
    } else if (event.key === "End") {
      event.preventDefault();
      event.stopPropagation();
      dragContext.moveWidgetToEdge(widget.id, "end");
    }
  };

  const frameClassName = [
    "widget-frame",
    `size-${layout}`,
    selected ? "is-selected" : "",
    isDragging ? "is-dragging" : "",
    isDropTarget ? "is-drop-target" : "",
  ].filter(Boolean).join(" ");

  return (
    <article
      className={frameClassName}
      aria-selected={selected}
      data-widget-id={widget.id}
      data-widget-kind={widget.kind}
      onDragEnter={() => dragContext?.onDragEnter(widget.id)}
      onDragOver={(event) => {
        dragContext?.onDragEnter(widget.id);
        dragContext?.onDragOver(event);
      }}
      onDrop={() => dragContext?.onDrop(widget.id)}
      onClick={() => {
        runtime.setSelectedWidgetId(widget.id);
        onSelectWidget.mutate(widget.id);
      }}
    >
      <header className="widget-header">
        <button
          type="button"
          className="drag-handle"
          aria-label={`Move ${widget.title}`}
          title="Drag to reorder"
          draggable
          onClick={(event) => event.stopPropagation()}
          onDragStart={(event) => dragContext?.onDragStart(widget.id, event)}
          onDragEnd={() => dragContext?.onDragEnd()}
          onKeyDown={handleDragKeyDown}
        >
        </button>
        <div className="widget-title-block">
          <div className="widget-title-row">
            <h3>{widget.title}</h3>
            <span className="widget-kind">{widget.kind}</span>
          </div>
          <span className={`status-pill status-${state.status}`}>{state.status}</span>
        </div>
        <div className="widget-actions">
          <button type="button" onClick={(event) => { event.stopPropagation(); run(); }}>Run</button>
          <button type="button" onClick={(event) => { event.stopPropagation(); onDuplicate.mutate(widget.id); }}>Copy</button>
          <button type="button" onClick={(event) => { event.stopPropagation(); remove(); }}>Remove</button>
        </div>
      </header>
      <div className="widget-body">
        {state.views.length > 0 ? (
          <ViewsRenderer
            views={pluginUiComponents}
            viewsData={state.views}
            createEvent={(eventUid, ...args) => runtime.invokeWidgetEvent(widget.id, eventUid, args)}
          />
        ) : (
          <div className="empty-widget">No plugin output yet.</div>
        )}
      </div>
      {(state.error || state.bundleError) && <pre className="widget-error">{state.bundleError ?? state.error}</pre>}
      {state.logs.length > 0 && (
        <div className="widget-log">
          {state.logs.slice(-3).map((log, index) => (
            <div key={`${log.level}-${index}`}>{log.level}: {log.message}</div>
          ))}
        </div>
      )}
    </article>
  );
}

export function PluginEditor(props: InferClientProps<typeof PluginEditorDef>): React.ReactElement | null {
  const { enabled } = useDevMode();
  if (!enabled) return null;
  return <PluginEditorInner {...props} />;
}

function PluginEditorInner({ widgetId, source, bundleError, onSourceChange, onBundle }: InferClientProps<typeof PluginEditorDef>): React.ReactElement {
  const runtime = useRuntime();
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const modelRef = useRef<monaco.editor.ITextModel | null>(null);
  const widgetIdRef = useRef(widgetId);
  const updateSourceRef = useRef(runtime.updateSource);
  const sourceChangeRef = useRef(onSourceChange.mutate);
  const activeSource = widgetId ? runtime.getWidgetState(widgetId).source : source;

  useEffect(() => {
    widgetIdRef.current = widgetId;
    updateSourceRef.current = runtime.updateSource;
    sourceChangeRef.current = onSourceChange.mutate;
  }, [onSourceChange.mutate, runtime.updateSource, widgetId]);

  useEffect(() => {
    if (!containerRef.current || editorRef.current) return;
    configureMonacoTypeScript();
    const model = monaco.editor.createModel(
      activeSource,
      "typescript",
      monaco.Uri.parse("file:///widget-plugin.tsx"),
    );
    modelRef.current = model;
    editorRef.current = monaco.editor.create(containerRef.current, {
      model,
      theme: "vs-dark",
      minimap: { enabled: false },
      fontSize: 13,
      automaticLayout: true,
      scrollBeyondLastLine: false,
      tabSize: 2,
    });
    const disposable = editorRef.current.onDidChangeModelContent(() => {
      const currentWidgetId = widgetIdRef.current;
      if (!currentWidgetId) return;
      const nextSource = editorRef.current?.getValue() ?? "";
      updateSourceRef.current(currentWidgetId, nextSource);
      sourceChangeRef.current({ widgetId: currentWidgetId, source: nextSource });
    });
    return () => {
      disposable.dispose();
      editorRef.current?.dispose();
      editorRef.current = null;
      modelRef.current?.dispose();
      modelRef.current = null;
    };
  }, []);

  useEffect(() => {
    window.__widgetPluginDemo = {
      setSource: (nextSource) => {
        editorRef.current?.setValue(nextSource);
        const currentWidgetId = widgetIdRef.current;
        if (!currentWidgetId) return;
        updateSourceRef.current(currentWidgetId, nextSource);
        sourceChangeRef.current({ widgetId: currentWidgetId, source: nextSource });
      },
      getSource: () => editorRef.current?.getValue() ?? "",
    };

    return () => {
      delete window.__widgetPluginDemo;
    };
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (editor.getValue() !== activeSource) {
      editor.setValue(activeSource);
    }
  }, [activeSource, widgetId]);

  const runSelected = (): void => {
    if (!widgetId) return;
    runtime.runWidgetById(widgetId, onBundle.mutate);
  };

  return (
    <aside className="editor-panel">
      <div className="editor-heading">
        <div>
          <h2>Plugin TSX</h2>
          <span>{widgetId ?? "No widget selected"}</span>
        </div>
        <button type="button" disabled={!widgetId} onClick={runSelected}>Run</button>
      </div>
      <div ref={containerRef} className="monaco-host" />
      {(bundleError || (widgetId ? runtime.getWidgetState(widgetId).bundleError : null)) && (
        <pre className="editor-error">{bundleError ?? (widgetId ? runtime.getWidgetState(widgetId).bundleError : null)}</pre>
      )}
    </aside>
  );
}

export function Stack({ direction = "vertical", gap = "md", children }: InferClientProps<typeof StackDef>): React.ReactElement {
  return <div className={`plugin-stack direction-${direction} gap-${gap}`}>{children}</div>;
}

export function Section({ title, description, children }: InferClientProps<typeof SectionDef>): React.ReactElement {
  return (
    <section className="plugin-section">
      <div className="plugin-section-heading">
        <strong>{title}</strong>
        {description && <span>{description}</span>}
      </div>
      <div className="plugin-section-body">{children}</div>
    </section>
  );
}

export function TextBlock({ text, tone = "default" }: InferClientProps<typeof TextBlockDef>): React.ReactElement {
  return <p className={`text-block tone-${tone}`}>{text}</p>;
}

export function Badge({ label, tone = "default" }: InferClientProps<typeof BadgeDef>): React.ReactElement {
  return <span className={`plugin-badge tone-${tone}`}>{label}</span>;
}

export function MetricCard({ title, value, delta, tone = "default" }: InferClientProps<typeof MetricCardDef>): React.ReactElement {
  return (
    <div className={`metric-card tone-${tone}`}>
      <span>{title}</span>
      <strong>{value}</strong>
      {delta && <em>{delta}</em>}
    </div>
  );
}

function boundedPercent(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
}

export function ProgressBar({ label, value, max = 100, tone = "default" }: InferClientProps<typeof ProgressBarDef>): React.ReactElement {
  const percent = boundedPercent(value, max);
  return (
    <div className={`progress-block tone-${tone}`}>
      <div className="progress-label">
        <span>{label}</span>
        <strong>{Math.round(percent)}%</strong>
      </div>
      <div className="progress-track">
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function StatList({ items }: InferClientProps<typeof StatListDef>): React.ReactElement {
  return (
    <dl className="stat-list">
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} className={`stat-row tone-${item.tone ?? "default"}`}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function LineChart({ title, points }: InferClientProps<typeof LineChartDef>): React.ReactElement {
  const gradientId = useId().replace(/:/g, "");
  const width = 320;
  const height = 110;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const spread = Math.max(max - min, 1);
  const chartPoints = points.map((point, index) => {
    const x = points.length <= 1 ? 0 : (index / (points.length - 1)) * width;
    const y = height - ((point - min) / spread) * height;
    return { x, y };
  });
  const path = chartPoints
    .map(({ x, y }, index) => `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const firstPoint = chartPoints[0] ?? { x: 0, y: height };
  const lastPoint = chartPoints[chartPoints.length - 1] ?? firstPoint;
  const areaPath = `${path} L ${lastPoint.x.toFixed(1)} ${height} L ${firstPoint.x.toFixed(1)} ${height} Z`;

  return (
    <div className="line-chart">
      <span>{title}</span>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        <defs>
          <linearGradient id={`${gradientId}-chart-fill`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradientId}-chart-fill)`} />
        <path d={path} fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={lastPoint.x} cy={lastPoint.y} r="5" fill="currentColor" />
        <circle cx={lastPoint.x} cy={lastPoint.y} r="8" fill="currentColor" opacity="0.16" />
      </svg>
    </div>
  );
}

export function SparkBars({ title, values, tone = "default" }: InferClientProps<typeof SparkBarsDef>): React.ReactElement {
  const max = Math.max(...values, 1);
  return (
    <div className={`spark-bars tone-${tone}`}>
      <span>{title}</span>
      <div className="spark-bars-row">
        {values.map((value, index) => (
          <i
            key={`${value}-${index}`}
            style={{ height: `${Math.max(12, boundedPercent(value, max))}%` }}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );
}

export function DataTable({ columns, rows }: InferClientProps<typeof DataTableDef>): React.ReactElement {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((column) => <td key={column}>{String(row[column] ?? "")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EditableTable({
  columns,
  rows,
  rowIdKey = "id",
  density = "regular",
  onCellChange,
}: InferClientProps<typeof EditableTableDef>): React.ReactElement {
  return (
    <div className={`editable-table-wrap density-${density}`} onClick={(event) => event.stopPropagation()}>
      <table>
        <thead>
          <tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            const rowId = String(row[rowIdKey] ?? rowIndex);
            return (
              <tr key={rowId}>
                {columns.map((column) => {
                  const kind = column.kind ?? "text";
                  const value = row[column.key] ?? "";
                  const label = `${column.label} ${rowId}`;

                  if (kind === "badge") {
                    return (
                      <td key={column.key}>
                        <span className={`editable-badge tone-${String(value).toLowerCase()}`}>
                          {String(value)}
                        </span>
                      </td>
                    );
                  }

                  if (kind === "select") {
                    return (
                      <td key={column.key}>
                        <select
                          aria-label={label}
                          value={String(value)}
                          onChange={(event) => {
                            onCellChange.mutate({
                              rowId,
                              column: column.key,
                              value: event.currentTarget.value,
                            });
                          }}
                        >
                          {(column.options ?? []).map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </td>
                    );
                  }

                  return (
                    <td key={column.key}>
                      <div className="editable-cell">
                        <input
                          aria-label={label}
                          inputMode={kind === "number" ? "decimal" : undefined}
                          type={kind === "number" ? "number" : "text"}
                          value={String(value)}
                          onChange={(event) => {
                            const nextValue = kind === "number" && event.currentTarget.value !== ""
                              ? Number(event.currentTarget.value)
                              : event.currentTarget.value;
                            onCellChange.mutate({
                              rowId,
                              column: column.key,
                              value: nextValue,
                            });
                          }}
                        />
                        {column.suffix && <span>{column.suffix}</span>}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Timeline({ items }: InferClientProps<typeof TimelineDef>): React.ReactElement {
  return (
    <ol className="timeline-list">
      {items.map((item, index) => (
        <li key={`${item.title}-${index}`} className={`tone-${item.tone ?? "default"}`}>
          <span />
          <div>
            <strong>{item.title}</strong>
            {item.meta && <em>{item.meta}</em>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Notice({ title, message, tone = "default" }: InferClientProps<typeof NoticeDef>): React.ReactElement {
  return (
    <div className={`plugin-notice tone-${tone}`}>
      <strong>{title}</strong>
      <span>{message}</span>
    </div>
  );
}

export function Checklist({ items }: InferClientProps<typeof ChecklistDef>): React.ReactElement {
  return (
    <ul className="checklist">
      {items.map((item, index) => (
        <li key={`${item.label}-${index}`} className={item.done ? "is-done" : ""}>
          <span>{item.done ? "Done" : "Open"}</span>
          <div>
            <strong>{item.label}</strong>
            {item.detail && <em>{item.detail}</em>}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function SegmentedControl({ label, value, options, onChange }: InferClientProps<typeof SegmentedControlDef>): React.ReactElement {
  return (
    <div className="segmented-control">
      <span>{label}</span>
      <div role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={option.value === value ? "is-active" : ""}
            aria-pressed={option.value === value}
            onClick={(event) => {
              event.stopPropagation();
              onChange.mutate(option.value);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ToggleSwitch({ label, checked, description, onChange }: InferClientProps<typeof ToggleSwitchDef>): React.ReactElement {
  return (
    <label className="toggle-switch" onClick={(event) => event.stopPropagation()}>
      <span className="toggle-copy">
        <strong>{label}</strong>
        {description && <em>{description}</em>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange.mutate(event.currentTarget.checked)}
      />
      <span className="toggle-track" aria-hidden="true" />
    </label>
  );
}

export function SliderControl({ label, value, min = 0, max = 100, step = 1, unit, onChange }: InferClientProps<typeof SliderControlDef>): React.ReactElement {
  return (
    <label className="slider-control" onClick={(event) => event.stopPropagation()}>
      <span>
        <strong>{label}</strong>
        <em>{value}{unit ?? ""}</em>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange.mutate(Number(event.currentTarget.value))}
      />
    </label>
  );
}

export function ActionButton({ label, variant = "primary", onClick }: InferClientProps<typeof ActionButtonDef>): React.ReactElement {
  return (
    <button
      type="button"
      className={`plugin-button variant-${variant}`}
      onClick={(event) => {
        event.stopPropagation();
        onClick.mutate();
      }}
    >
      {label}
    </button>
  );
}
