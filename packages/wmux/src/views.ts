import { view, callback, stream, createViews } from "@playfast/echoform";
import { z } from "zod";

const processStatus = z.enum(["idle", "running", "stopped", "failed"]);

const processInfo = z.object({
  id: z.string(),
  name: z.string(),
  status: processStatus,
  category: z.string(),
});

const categoryInfo = z.object({
  name: z.string(),
  color: z.string(),
  processCount: z.number(),
});

const panelPosition = z.object({
  referencePanel: z.string().optional(),
  direction: z.enum(["left", "right", "above", "below", "within"]).optional(),
});

const layoutConfig = z.object({
  preset: z.enum(["tabs", "split-horizontal", "split-vertical", "grid"]).optional(),
  panels: z.record(z.string(), panelPosition).optional(),
});

export const WmuxApp = view("WmuxApp", {
  input: {
    processes: z.array(processInfo),
    categories: z.array(categoryInfo),
    activeProcessId: z.string(),
    layout: layoutConfig.optional(),
  },
  callbacks: {
    onSelectProcess: callback({ input: z.string() }),
    onStartProcess: callback({ input: z.string() }),
    onStopProcess: callback({ input: z.string() }),
    onRestartProcess: callback({ input: z.string() }),
  },
});

export const WmuxTerminal = view("WmuxTerminal", {
  input: {
    id: z.string(),
    name: z.string(),
    status: processStatus,
  },
  callbacks: {
    onInput: callback({ input: z.string() }),
    onResize: callback({ input: z.object({ cols: z.number(), rows: z.number() }) }),
  },
  streams: {
    output: stream(z.string()),
  },
});

export const views = createViews({ WmuxApp, WmuxTerminal });
