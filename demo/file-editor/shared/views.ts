import { view, callback, createViews, passthrough } from "@react-fullstack/fullstack";
import { z } from "zod";
import type { FileNode, OpenFile } from "./types";

export const App = view("App", {
  input: {
    rootPath: z.string(),
    title: z.string(),
  },
});

export const FileTree = view("FileTree", {
  input: {
    files: passthrough<FileNode | null>(),
    selectedPath: passthrough<string | null>(),
  },
  callbacks: {
    onSelect: callback({ input: z.string() }),
    onRefresh: callback(),
  },
});

export const TabBar = view("TabBar", {
  input: {
    openFiles: passthrough<readonly OpenFile[]>(),
    activeFilePath: passthrough<string | null>(),
  },
  callbacks: {
    onSelectTab: callback({ input: z.string() }),
    onCloseTab: callback({ input: z.string() }),
  },
});

export const CodeEditor = view("CodeEditor", {
  input: {
    path: z.string(),
    content: z.string(),
    language: z.string(),
  },
  callbacks: {
    onChange: callback({ input: z.string() }),
    onSave: callback(),
  },
});

export const ExcalidrawEditor = view("ExcalidrawEditor", {
  input: {
    path: z.string(),
    content: z.string(),
  },
  callbacks: {
    onChange: callback({ input: z.string() }),
    onSave: callback(),
  },
});

export const EmptyEditor = view("EmptyEditor", {
  input: { message: z.string() },
});

export const ErrorDisplay = view("ErrorDisplay", {
  input: { error: z.string() },
  callbacks: { onDismiss: callback() },
});

export const views = createViews({ App, FileTree, TabBar, CodeEditor, ExcalidrawEditor, EmptyEditor, ErrorDisplay });
