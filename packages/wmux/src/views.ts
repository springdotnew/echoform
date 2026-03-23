import { view, callback, stream, createViews } from "@playfast/echoform";
import { z } from "zod";

const processStatus = z.enum(["idle", "running", "stopped", "failed"]);

const tabInfo = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  status: processStatus,
});

const categoryInfo = z.object({
  name: z.string(),
  color: z.string(),
  icon: z.string().optional(),
  tabs: z.array(tabInfo),
});

const fileEntry = z.object({
  path: z.string(),
  name: z.string(),
  isDir: z.boolean(),
  depth: z.number(),
  isExpanded: z.boolean(),
});

export const WmuxApp = view("WmuxApp", {
  input: {
    categories: z.array(categoryInfo),
    activeCategory: z.string(),
    activeTabId: z.string(),
  },
  callbacks: {
    onSelectCategory: callback({ input: z.string() }),
    onSelectTab: callback({ input: z.string() }),
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

export const WmuxFileViewer = view("WmuxFileViewer", {
  input: {
    id: z.string(),
    entries: z.array(fileEntry),
    selectedPath: z.string(),
    selectedContent: z.string(),
  },
  callbacks: {
    onToggleDir: callback({ input: z.string() }),
    onSelectFile: callback({ input: z.string() }),
  },
});

export const views = createViews({ WmuxApp, WmuxTerminal, WmuxFileViewer });
