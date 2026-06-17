import { createBirpc } from "birpc";
import { getQuickJS, type QuickJSContext } from "quickjs-emscripten";
import type { JsonObject } from "../../shared/plugin-types";
import { pluginTreeToViews } from "./echoform-tree";
import type {
  DisposePluginInput,
  InvokeEventInput,
  LoadPluginInput,
  MainRpc,
  RenderInput,
  WorkerPhase,
  WorkerResult,
  WorkerRpc,
} from "./protocol";

interface WidgetInstance {
  readonly widgetId: string;
  readonly version: number;
  readonly vm: QuickJSContext;
}

interface RenderPayload {
  readonly tree: unknown;
  readonly state: JsonObject;
}

const instances = new Map<string, WidgetInstance>();
let mainRpc: ReturnType<typeof createBirpc<MainRpc, WorkerRpc>> | null = null;

function formatVmError(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null) {
    const record = value as Readonly<Record<string, unknown>>;
    const name = typeof record["name"] === "string" ? record["name"] : "Error";
    const message = typeof record["message"] === "string" ? record["message"] : JSON.stringify(record);
    return `${name}: ${message}`;
  }
  return String(value);
}

function jsonLiteral(value: unknown): string {
  return JSON.stringify(JSON.stringify(value));
}

function evalVm(vm: QuickJSContext, code: string): unknown {
  const result = vm.evalCode(code);
  if (result.error) {
    const error = vm.dump(result.error) as unknown;
    result.error.dispose();
    throw new Error(formatVmError(error));
  }

  const value = vm.dump(result.value) as unknown;
  result.value.dispose();
  return value;
}

function evalVmJson<T>(vm: QuickJSContext, code: string): T {
  const value = evalVm(vm, code);
  if (typeof value !== "string") {
    throw new Error("Plugin runtime returned a non-string JSON payload.");
  }
  return JSON.parse(value) as T;
}

function setExecutionDeadline(vm: QuickJSContext): void {
  const deadline = Date.now() + 250;
  vm.runtime.setInterruptHandler(() => Date.now() > deadline);
}

function installConsole(vm: QuickJSContext, widgetId: string): void {
  const consoleHandle = vm.newObject();

  const createLogFunction = (level: "log" | "warn" | "error") =>
    vm.newFunction(level, (...args) => {
      const message = args.map((arg) => formatVmError(vm.dump(arg) as unknown)).join(" ");
      mainRpc?.log.asEvent({ widgetId, level, message });
      return vm.undefined;
    });

  const logHandle = createLogFunction("log");
  const warnHandle = createLogFunction("warn");
  const errorHandle = createLogFunction("error");

  vm.setProp(consoleHandle, "log", logHandle);
  vm.setProp(consoleHandle, "warn", warnHandle);
  vm.setProp(consoleHandle, "error", errorHandle);
  vm.setProp(vm.global, "console", consoleHandle);

  logHandle.dispose();
  warnHandle.dispose();
  errorHandle.dispose();
  consoleHandle.dispose();
}

function installRuntime(vm: QuickJSContext, input: LoadPluginInput): void {
  const runtimeSource = `
globalThis.__widgetState = JSON.parse(${jsonLiteral(input.initialState ?? {})});
globalThis.__widgetData = JSON.parse(${jsonLiteral(input.data)});
globalThis.__widgetRuntime = {
  eventCounter: 0,
  eventHandlers: Object.create(null),
  Fragment: "Fragment",
  ui: {
    Stack: "Stack",
    Section: "Section",
    TextBlock: "TextBlock",
    Badge: "Badge",
    MetricCard: "MetricCard",
    ProgressBar: "ProgressBar",
    StatList: "StatList",
    LineChart: "LineChart",
    SparkBars: "SparkBars",
    DataTable: "DataTable",
    Timeline: "Timeline",
    Notice: "Notice",
    Checklist: "Checklist",
    SegmentedControl: "SegmentedControl",
    ToggleSwitch: "ToggleSwitch",
    SliderControl: "SliderControl",
    ActionButton: "ActionButton"
  },
  h(type, props, ...children) {
    const normalizedProps = {};
    for (const [key, value] of Object.entries(props || {})) {
      if (typeof value === "function") {
        const eventId = "e" + (++globalThis.__widgetRuntime.eventCounter);
        globalThis.__widgetRuntime.eventHandlers[eventId] = value;
        normalizedProps[key] = { $$event: eventId };
      } else {
        normalizedProps[key] = value;
      }
    }
    const flatChildren = [];
    const pushChild = (child) => {
      if (Array.isArray(child)) {
        child.forEach(pushChild);
      } else if (child !== undefined && child !== null && child !== false) {
        flatChildren.push(child);
      }
    };
    children.forEach(pushChild);
    if (type === "Fragment") {
      return flatChildren[0] || null;
    }
    return { $$type: "widget.element", type, props: normalizedProps, children: flatChildren };
  }
};
globalThis.__widgetSetState = function(nextState) {
  if (!nextState || typeof nextState !== "object" || Array.isArray(nextState)) {
    throw new Error("setState expects an object.");
  }
  globalThis.__widgetState = Object.assign({}, globalThis.__widgetState, nextState);
};
globalThis.__widgetRender = function() {
  if (typeof globalThis.__widgetDefault !== "function") {
    throw new Error("Plugin must export a default function component.");
  }
  globalThis.__widgetRuntime.eventCounter = 0;
  globalThis.__widgetRuntime.eventHandlers = Object.create(null);
  const tree = globalThis.__widgetDefault({
    state: globalThis.__widgetState,
    setState: globalThis.__widgetSetState,
    data: globalThis.__widgetData
  });
  return JSON.stringify({ tree, state: globalThis.__widgetState });
};
globalThis.__widgetInvoke = function(eventId, argsJson) {
  const handler = globalThis.__widgetRuntime.eventHandlers[eventId];
  if (typeof handler !== "function") {
    throw new Error("Unknown plugin event: " + eventId);
  }
  const args = JSON.parse(argsJson);
  handler.apply(null, args);
  return globalThis.__widgetRender();
};
`;

  setExecutionDeadline(vm);
  evalVm(vm, runtimeSource);
}

function renderInstance(instance: WidgetInstance, phase: WorkerPhase): WorkerResult {
  try {
    setExecutionDeadline(instance.vm);
    const payload = evalVmJson<RenderPayload>(instance.vm, "globalThis.__widgetRender()");
    const views = pluginTreeToViews(instance.widgetId, payload.tree);
    mainRpc?.status.asEvent({ widgetId: instance.widgetId, status: "running" });
    return {
      ok: true,
      widgetId: instance.widgetId,
      version: instance.version,
      views,
      state: payload.state,
    };
  } catch (error) {
    mainRpc?.status.asEvent({ widgetId: instance.widgetId, status: "error" });
    return {
      ok: false,
      widgetId: instance.widgetId,
      phase,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function disposeInstance(widgetId: string): void {
  const existing = instances.get(widgetId);
  if (!existing) return;
  instances.delete(widgetId);
  existing.vm.dispose();
}

const workerFunctions: WorkerRpc = {
  async loadPlugin(input: LoadPluginInput): Promise<WorkerResult> {
    disposeInstance(input.widgetId);
    mainRpc?.status.asEvent({ widgetId: input.widgetId, status: "loading" });

    try {
      const QuickJS = await getQuickJS();
      const vm = QuickJS.newContext();
      vm.runtime.setMemoryLimit(1024 * 1024 * 8);
      vm.runtime.setMaxStackSize(1024 * 512);
      installConsole(vm, input.widgetId);
      installRuntime(vm, input);
      setExecutionDeadline(vm);
      evalVm(vm, input.code);

      const instance: WidgetInstance = {
        widgetId: input.widgetId,
        version: input.version,
        vm,
      };
      instances.set(input.widgetId, instance);
      return renderInstance(instance, "load");
    } catch (error) {
      mainRpc?.status.asEvent({ widgetId: input.widgetId, status: "error" });
      return {
        ok: false,
        widgetId: input.widgetId,
        phase: "load",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  async render(input: RenderInput): Promise<WorkerResult> {
    const instance = instances.get(input.widgetId);
    if (!instance) {
      return { ok: false, widgetId: input.widgetId, phase: "render", error: "Plugin is not loaded." };
    }
    return renderInstance(instance, "render");
  },

  async invokeEvent(input: InvokeEventInput): Promise<WorkerResult> {
    const instance = instances.get(input.widgetId);
    if (!instance) {
      return { ok: false, widgetId: input.widgetId, phase: "event", error: "Plugin is not loaded." };
    }

    try {
      setExecutionDeadline(instance.vm);
      const payload = evalVmJson<RenderPayload>(
        instance.vm,
        `globalThis.__widgetInvoke(${JSON.stringify(input.eventId)}, ${jsonLiteral(input.args)})`,
      );
      const views = pluginTreeToViews(instance.widgetId, payload.tree);
      mainRpc?.status.asEvent({ widgetId: instance.widgetId, status: "running" });
      return {
        ok: true,
        widgetId: instance.widgetId,
        version: instance.version,
        views,
        state: payload.state,
      };
    } catch (error) {
      mainRpc?.status.asEvent({ widgetId: instance.widgetId, status: "error" });
      return {
        ok: false,
        widgetId: instance.widgetId,
        phase: "event",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  async disposePlugin(input: DisposePluginInput): Promise<void> {
    disposeInstance(input.widgetId);
    mainRpc?.status.asEvent({ widgetId: input.widgetId, status: "idle" });
  },
};

mainRpc = createBirpc<MainRpc, WorkerRpc>(workerFunctions, {
  post: (data) => self.postMessage(data),
  on: (handler) => {
    const listener = (event: MessageEvent<unknown>): void => handler(event.data);
    self.addEventListener("message", listener);
  },
  eventNames: ["log", "status"],
});
