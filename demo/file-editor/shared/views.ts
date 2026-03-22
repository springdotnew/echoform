import type { View } from "@react-fullstack/fullstack/shared";
import type { FileNode, OpenFile } from "./types";

export type Views = {
  readonly App: View<{
    readonly rootPath: string;
    readonly title: string;
  }>;

  readonly FileTree: View<{
    readonly files: FileNode | null;
    readonly selectedPath: string | null;
    readonly onSelect: (path: string) => void;
    readonly onRefresh: () => void;
  }>;

  readonly TabBar: View<{
    readonly openFiles: readonly OpenFile[];
    readonly activeFilePath: string | null;
    readonly onSelectTab: (path: string) => void;
    readonly onCloseTab: (path: string) => void;
  }>;

  readonly CodeEditor: View<{
    readonly path: string;
    readonly content: string;
    readonly language: string;
    readonly onChange: (content: string) => void;
    readonly onSave: () => void;
  }>;

  readonly ExcalidrawEditor: View<{
    readonly path: string;
    readonly content: string;
    readonly onChange: (content: string) => void;
    readonly onSave: () => void;
  }>;

  readonly EmptyEditor: View<{
    readonly message: string;
  }>;

  readonly ErrorDisplay: View<{
    readonly error: string;
    readonly onDismiss: () => void;
  }>;
};
