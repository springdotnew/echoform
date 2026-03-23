import { view, callback, stream, createViews } from "@react-fullstack/fullstack";
import { z } from "zod";

export const TerminalApp = view("TerminalApp", {
  input: {
    workspaces: z.array(z.object({ id: z.string(), name: z.string() })),
    activeWorkspaceId: z.string(),
  },
  callbacks: {
    onNewWorkspace: callback(),
    onSelectWorkspace: callback({ input: z.string() }),
    onCloseWorkspace: callback({ input: z.string() }),
  },
});

export const Workspace = view("Workspace", {
  input: {
    id: z.string(),
    tabs: z.array(z.object({ id: z.string(), title: z.string() })),
    activeTabId: z.string(),
  },
  callbacks: {
    onNewTab: callback(),
    onCloseTab: callback({ input: z.string() }),
    onSelectTab: callback({ input: z.string() }),
  },
});

export const Terminal = view("Terminal", {
  input: {
    id: z.string(),
    title: z.string(),
  },
  callbacks: {
    onInput: callback({ input: z.string() }),
    onResize: callback({ input: z.object({ cols: z.number(), rows: z.number() }) }),
  },
  streams: {
    output: stream(z.string()),
  },
});

export const views = createViews({ TerminalApp, Workspace, Terminal });
