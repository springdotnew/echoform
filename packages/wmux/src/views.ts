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

const fileEntry = z.object({
  path: z.string(),
  name: z.string(),
  isDir: z.boolean(),
  depth: z.number(),
  isExpanded: z.boolean(),
});

const openFileInfo = z.object({
  path: z.string(),
  name: z.string(),
});

const categoryInfo = z.object({
  name: z.string(),
  color: z.string(),
  icon: z.string().optional(),
  type: z.enum(["process", "files"]),
  tabs: z.array(tabInfo),
  fileEntries: z.array(fileEntry).optional(),
  openFiles: z.array(openFileInfo).optional(),
});

export const WmuxApp = view("WmuxApp", {
  input: {
    title: z.string(),
    description: z.string(),
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
    onToggleDir: callback({ input: z.string() }),
    onOpenFile: callback({ input: z.string() }),
    onCloseFile: callback({ input: z.string() }),
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

export const WmuxFileContent = view("WmuxFileContent", {
  input: {
    id: z.string(),
    path: z.string(),
    name: z.string(),
    content: z.string(),
  },
});

export const WmuxIframe = view("WmuxIframe", {
  input: {
    id: z.string(),
    name: z.string(),
    url: z.string(),
  },
});

export const views = createViews({ WmuxApp, WmuxTerminal, WmuxFileContent, WmuxIframe });
