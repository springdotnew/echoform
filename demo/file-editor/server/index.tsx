import React, { useState, useCallback, useEffect } from "react";
import * as path from "path";
import { Render } from "@playfast/echoform-render";
import { Server } from "@playfast/echoform/server";
import { createBunWebSocketServer } from "@playfast/echoform-bun-ws-server";
import {
  listDirectory,
  readFile,
  writeFile,
  getLanguageFromPath,
  validatePath,
} from "./file-operations";
import { App as AppView, FileTree, TabBar, CodeEditor, ExcalidrawEditor, EmptyEditor, ErrorDisplay } from "../shared/views";
import type { FileNode, OpenFile } from "../shared/types";

const rootPath = path.resolve(process.argv[2] ?? ".");

function hasFileAccess(filePath: string, setError: (msg: string) => void): boolean {
  if (validatePath(rootPath, filePath)) return true;
  setError("Access denied: path outside root directory");
  return false;
}

function formatFileError(action: string, err: unknown): string {
  return `Failed to ${action}: ${err instanceof Error ? err.message : String(err)}`;
}

function FileEditorApp(): React.ReactElement | null {
  const [files, setFiles] = useState<FileNode | null>(null);
  const [openFiles, setOpenFiles] = useState<readonly OpenFile[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshFileTree = useCallback(async () => {
    try {
      const tree = await listDirectory(rootPath);
      setFiles(tree);
    } catch (err) {
      setError(formatFileError("load directory", err));
    }
  }, []);

  useEffect(() => {
    refreshFileTree();
  }, [refreshFileTree]);

  const handleSelectFile = useCallback(
    async (filePath: string) => {
      if (!hasFileAccess(filePath, setError)) return;

      const existing = openFiles.find((file) => file.path === filePath);
      if (existing) {
        setActiveFilePath(filePath);
        return;
      }

      try {
        const content = await readFile(filePath);
        const name = path.basename(filePath);
        const isExcalidraw = filePath.endsWith(".excalidraw");
        const language = getLanguageFromPath(filePath);

        const newFile: OpenFile = {
          path: filePath,
          name,
          content,
          language,
          isExcalidraw,
          isDirty: false,
        };

        setOpenFiles((prev) => [...prev, newFile]);
        setActiveFilePath(filePath);
      } catch (err) {
        setError(formatFileError("open file", err));
      }
    },
    [openFiles]
  );

  const handleContentChange = useCallback((filePath: string, content: string) => {
    setOpenFiles((prev) =>
      prev.map((file) => (file.path === filePath ? { ...file, content, isDirty: true } : file))
    );
  }, []);

  const handleSave = useCallback(
    async (filePath: string) => {
      if (!hasFileAccess(filePath, setError)) return;

      const file = openFiles.find((openFile) => openFile.path === filePath);
      if (!file) return;

      try {
        await writeFile(filePath, file.content);
        setOpenFiles((prev) =>
          prev.map((file) => (file.path === filePath ? { ...file, isDirty: false } : file))
        );
      } catch (err) {
        setError(formatFileError("save file", err));
      }
    },
    [openFiles]
  );

  const handleCloseTab = useCallback(
    (filePath: string) => {
      setOpenFiles((prev) => prev.filter((file) => file.path !== filePath));
      if (activeFilePath === filePath) {
        const remaining = openFiles.filter((file) => file.path !== filePath);
        setActiveFilePath(remaining.length > 0 ? remaining[0]?.path ?? null : null);
      }
    },
    [openFiles, activeFilePath]
  );

  const handleSelectTab = useCallback((filePath: string) => {
    setActiveFilePath(filePath);
  }, []);

  const handleDismissError = useCallback(() => {
    setError(null);
  }, []);

  const activeFile = openFiles.find((file) => file.path === activeFilePath);

  return (
    <AppView rootPath={rootPath} title="File Editor">
      {error && <ErrorDisplay error={error} onDismiss={handleDismissError} />}

      <FileTree
        files={files}
        selectedPath={activeFilePath}
        onSelect={handleSelectFile}
        onRefresh={refreshFileTree}
      />

      <TabBar
        openFiles={openFiles}
        activeFilePath={activeFilePath}
        onSelectTab={handleSelectTab}
        onCloseTab={handleCloseTab}
      >
        {activeFile ? (
          activeFile.isExcalidraw ? (
            <ExcalidrawEditor
              path={activeFile.path}
              content={activeFile.content}
              onChange={(content) => handleContentChange(activeFile.path, content)}
              onSave={() => handleSave(activeFile.path)}
            />
          ) : (
            <CodeEditor
              path={activeFile.path}
              content={activeFile.content}
              language={activeFile.language}
              onChange={(content) => handleContentChange(activeFile.path, content)}
              onSave={() => handleSave(activeFile.path)}
            />
          )
        ) : (
          <EmptyEditor message="Select a file to edit" />
        )}
      </TabBar>
    </AppView>
  );
}

const PORT = parseInt(process.env.PORT ?? "4210", 10);

const { transport, start } = createBunWebSocketServer({
  port: PORT,
  path: "/ws",
});

const server = start();

console.log(`File Editor server running on ws://localhost:${PORT}/ws`);
console.log(`Editing: ${rootPath}`);

process.on("SIGINT", () => {
  server.stop();
  process.exit(0);
});
process.on("SIGTERM", () => {
  server.stop();
  process.exit(0);
});

Render(
  <Server transport={transport} singleInstance>
    {() => <FileEditorApp />}
  </Server>
);
