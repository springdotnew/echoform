import { view, callback, createViews } from "@react-fullstack/fullstack";
import { z } from "zod";
import type { FileNode, OpenFile } from "./types";
import type { StandardSchemaV1 } from "@react-fullstack/fullstack";

/** Schema for complex types that can't be expressed with zod alone. */
function s<T>(): StandardSchemaV1<T> {
  return {
    "~standard": {
      version: 1,
      vendor: "passthrough",
      validate: (value) => ({ value: value as T }),
    },
  };
}

export const App = view("App", {
  input: {
    rootPath: z.string(),
    title: z.string(),
  },
});

export const FileTree = view("FileTree", {
  input: {
    files: s<FileNode | null>(),
    selectedPath: s<string | null>(),
  },
  callbacks: {
    onSelect: callback({ input: z.string() }),
    onRefresh: callback(),
  },
});

export const TabBar = view("TabBar", {
  input: {
    openFiles: s<readonly OpenFile[]>(),
    activeFilePath: s<string | null>(),
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
