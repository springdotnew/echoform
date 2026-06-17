import { createBirpc, type BirpcReturn } from "birpc";
import type { Prop, SerializableValue } from "@playfast/echoform";
import type { JsonObject, PluginLog } from "../../shared/plugin-types";
import type {
  LoadPluginInput,
  MainRpc,
  PluginStatus,
  WorkerResult,
  WorkerRpc,
} from "./protocol";

type EventUidValue = Extract<Prop, { readonly type: "event" }>["uid"];

interface PoolWorker {
  readonly worker: Worker;
  readonly rpc: BirpcReturn<WorkerRpc, MainRpc>;
  readonly widgetIds: Set<string>;
}

interface PoolOptions {
  readonly onLog: (log: PluginLog) => void;
  readonly onStatus: (status: PluginStatus) => void;
  readonly onWorkerError: (widgetIds: readonly string[], error: string) => void;
}

export interface LoadPluginRequest {
  readonly widgetId: string;
  readonly version: number;
  readonly code: string;
  readonly data: JsonObject;
  readonly initialState?: JsonObject;
}

export interface InvokePluginEventRequest {
  readonly widgetId: string;
  readonly eventUid: EventUidValue;
  readonly args: readonly SerializableValue[];
}

function hashWidgetId(widgetId: string): number {
  let hash = 0;
  for (const char of widgetId) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function eventIdFromUid(widgetId: string, eventUid: EventUidValue): string {
  const prefix = `plugin:${widgetId}:`;
  const raw = eventUid as string;
  if (!raw.startsWith(prefix)) {
    throw new Error(`Event ${raw} does not belong to widget ${widgetId}.`);
  }
  return raw.slice(prefix.length);
}

export class PluginWorkerPool {
  readonly workerCount: number;
  private readonly workers: PoolWorker[] = [];
  private readonly options: PoolOptions;

  constructor(options: PoolOptions) {
    this.options = options;
    this.workerCount = Math.max(1, Math.min(4, navigator.hardwareConcurrency || 2));
    for (let index = 0; index < this.workerCount; index += 1) {
      this.workers.push(this.createWorker(index));
    }
  }

  async loadPlugin(input: LoadPluginRequest): Promise<WorkerResult> {
    const worker = this.workerForWidget(input.widgetId);
    worker.widgetIds.add(input.widgetId);
    const payload: LoadPluginInput = {
      widgetId: input.widgetId,
      version: input.version,
      code: input.code,
      data: input.data,
      ...(input.initialState ? { initialState: input.initialState } : {}),
    };
    return worker.rpc.loadPlugin(payload);
  }

  async render(widgetId: string): Promise<WorkerResult> {
    return this.workerForWidget(widgetId).rpc.render({ widgetId });
  }

  async invokeEvent(input: InvokePluginEventRequest): Promise<WorkerResult> {
    return this.workerForWidget(input.widgetId).rpc.invokeEvent({
      widgetId: input.widgetId,
      eventId: eventIdFromUid(input.widgetId, input.eventUid),
      args: input.args,
    });
  }

  disposePlugin(widgetId: string): void {
    const worker = this.workerForWidget(widgetId);
    worker.widgetIds.delete(widgetId);
    worker.rpc.disposePlugin({ widgetId }).catch((error: unknown) => {
      this.options.onWorkerError([widgetId], error instanceof Error ? error.message : String(error));
    });
  }

  destroy(): void {
    for (const worker of this.workers) {
      worker.rpc.$close();
      worker.worker.terminate();
      worker.widgetIds.clear();
    }
    this.workers.length = 0;
  }

  private workerForWidget(widgetId: string): PoolWorker {
    const worker = this.workers[hashWidgetId(widgetId) % this.workers.length];
    if (!worker) throw new Error("Plugin worker pool is not initialized.");
    return worker;
  }

  private createWorker(index: number): PoolWorker {
    const worker = new Worker(new URL("./plugin.worker.ts", import.meta.url), { type: "module" });
    const mainFunctions: MainRpc = {
      log: this.options.onLog,
      status: this.options.onStatus,
    };

    const rpc = createBirpc<WorkerRpc, MainRpc>(mainFunctions, {
      post: (data) => worker.postMessage(data),
      on: (handler) => {
        const listener = (event: MessageEvent<unknown>): void => handler(event.data);
        worker.addEventListener("message", listener);
      },
      timeout: 10_000,
    });

    const poolWorker: PoolWorker = { worker, rpc, widgetIds: new Set<string>() };

    worker.addEventListener("error", (event) => {
      const failedWidgets = [...poolWorker.widgetIds];
      this.options.onWorkerError(failedWidgets, event.message);
      const replacement = this.createWorker(index);
      this.workers[index] = replacement;
    });

    return poolWorker;
  }
}
