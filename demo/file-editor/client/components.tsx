import React, { useState, useRef, useEffect, useCallback, useMemo, type ReactNode } from "react";
import type { FileNode, OpenFile } from "../shared/types";

// --- App ---

interface AppProps {
  readonly rootPath: string;
  readonly title: string;
  readonly children?: ReactNode;
}

export function App({ rootPath, title, children }: AppProps): React.ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#1e1e1e" }}>
      <div style={{ padding: "8px 16px", background: "#252526", borderBottom: "1px solid #3c3c3c", fontSize: "14px", color: "#cccccc" }}>
        {title} - {rootPath}
      </div>
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>{children}</div>
    </div>
  );
}

// --- FileTree ---

interface FileTreeProps {
  readonly files: FileNode | null;
  readonly selectedPath: string | null;
  readonly onSelect: (path: string) => void;
  readonly onRefresh: () => void;
  readonly children?: ReactNode;
}

function FileTreeNode({
  node,
  depth,
  selectedPath,
  expanded,
  onToggleExpand,
  onSelect,
}: {
  readonly node: FileNode;
  readonly depth: number;
  readonly selectedPath: string | null;
  readonly expanded: ReadonlySet<string>;
  readonly onToggleExpand: (path: string) => void;
  readonly onSelect: (path: string) => void;
}): React.ReactElement {
  const isExpanded = expanded.has(node.path);
  const isSelected = node.path === selectedPath;

  return (
    <div>
      <div
        onClick={() => (node.isDirectory ? onToggleExpand(node.path) : onSelect(node.path))}
        style={{
          padding: "4px 8px",
          paddingLeft: `${depth * 16 + 8}px`,
          cursor: "pointer",
          background: isSelected ? "#094771" : "transparent",
          display: "flex",
          alignItems: "center",
          gap: "4px",
          fontSize: "13px",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ width: "16px", textAlign: "center" }}>
          {node.isDirectory ? (isExpanded ? "\u25BC" : "\u25B6") : ""}
        </span>
        <span>{node.isDirectory ? "\uD83D\uDCC1" : "\uD83D\uDCC4"}</span>
        <span style={{ marginLeft: "4px" }}>{node.name}</span>
      </div>
      {node.isDirectory &&
        isExpanded &&
        node.children?.map((child) => (
          <FileTreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            selectedPath={selectedPath}
            expanded={expanded}
            onToggleExpand={onToggleExpand}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}

export function FileTree({ files, selectedPath, onSelect, onRefresh }: FileTreeProps): React.ReactElement {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set([files?.path]));

  const toggleExpand = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  return (
    <div style={{ width: "250px", background: "#252526", borderRight: "1px solid #3c3c3c", overflow: "auto", flexShrink: 0 }}>
      <div style={{ padding: "8px", borderBottom: "1px solid #3c3c3c", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "11px", textTransform: "uppercase", color: "#888" }}>Explorer</span>
        <button
          onClick={() => onRefresh()}
          style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: "14px" }}
        >
          &#x21bb;
        </button>
      </div>
      {files && (
        <FileTreeNode
          node={files}
          depth={0}
          selectedPath={selectedPath}
          expanded={expanded}
          onToggleExpand={toggleExpand}
          onSelect={onSelect}
        />
      )}
    </div>
  );
}

// --- TabBar ---

interface TabBarProps {
  readonly openFiles: readonly OpenFile[];
  readonly activeFilePath: string | null;
  readonly onSelectTab: (path: string) => void;
  readonly onCloseTab: (path: string) => void;
  readonly children?: ReactNode;
}

export function TabBar({ openFiles, activeFilePath, onSelectTab, onCloseTab, children }: TabBarProps): React.ReactElement {
  if (openFiles.length === 0) return <>{children}</>;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      <div style={{ display: "flex", background: "#252526", borderBottom: "1px solid #3c3c3c", overflow: "auto", flexShrink: 0 }}>
        {openFiles.map((file) => (
          <div
            key={file.path}
            onClick={() => onSelectTab(file.path)}
            style={{
              padding: "8px 12px",
              cursor: "pointer",
              background: file.path === activeFilePath ? "#1e1e1e" : "transparent",
              borderRight: "1px solid #3c3c3c",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "13px",
              whiteSpace: "nowrap",
            }}
          >
            <span>{file.isDirty ? "\u25CF " : ""}{file.name}</span>
            <span
              onClick={(e) => { e.stopPropagation(); onCloseTab(file.path); }}
              style={{ opacity: 0.6, cursor: "pointer" }}
            >
              &times;
            </span>
          </div>
        ))}
      </div>
      {children}
    </div>
  );
}

// --- CodeEditor (Monaco) ---

interface CodeEditorProps {
  readonly path: string;
  readonly content: string;
  readonly language: string;
  readonly onChange: (content: string) => void;
  readonly onSave: () => void;
  readonly children?: ReactNode;
}

declare global {
  interface Window {
    require: {
      config: (opts: { paths: Record<string, string> }) => void;
      (deps: string[], cb: () => void): void;
    };
    monaco: {
      editor: {
        create: (el: HTMLElement, opts: Record<string, unknown>) => MonacoEditor;
        setModelLanguage: (model: MonacoModel, lang: string) => void;
      };
      KeyMod: { CtrlCmd: number };
      KeyCode: { KeyS: number };
    };
  }
}

interface MonacoModel {
  getValue(): string;
  setValue(value: string): void;
}

interface MonacoEditor {
  dispose(): void;
  getValue(): string;
  getModel(): MonacoModel | null;
  onDidChangeModelContent(cb: () => void): void;
  addCommand(keybinding: number, handler: () => void): void;
}

const MONACO_CDN = "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.0/min/vs";

export function CodeEditor({ path, content, language, onChange, onSave }: CodeEditorProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<MonacoEditor | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!window.require) {
      const script = document.createElement("script");
      script.src = `${MONACO_CDN}/loader.js`;
      script.onload = () => {
        window.require.config({ paths: { vs: MONACO_CDN } });
        window.require(["vs/editor/editor.main"], () => setReady(true));
      };
      document.head.appendChild(script);
    } else {
      window.require.config({ paths: { vs: MONACO_CDN } });
      window.require(["vs/editor/editor.main"], () => setReady(true));
    }
  }, []);

  useEffect(() => {
    if (!ready || !containerRef.current) return;

    if (!editorRef.current) {
      editorRef.current = window.monaco.editor.create(containerRef.current, {
        value: content,
        language,
        theme: "vs-dark",
        automaticLayout: true,
        minimap: { enabled: true },
        fontSize: 14,
        tabSize: 2,
      });

      editorRef.current.onDidChangeModelContent(() => {
        if (editorRef.current) onChange(editorRef.current.getValue());
      });

      editorRef.current.addCommand(
        window.monaco.KeyMod.CtrlCmd | window.monaco.KeyCode.KeyS,
        onSave,
      );
    }

    return () => {
      editorRef.current?.dispose();
      editorRef.current = null;
    };
  }, [ready]);

  useEffect(() => {
    if (!editorRef.current) return;
    const model = editorRef.current.getModel();
    if (model) {
      window.monaco.editor.setModelLanguage(model, language);
      if (model.getValue() !== content) {
        model.setValue(content);
      }
    }
  }, [path, content, language]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div ref={containerRef} style={{ flex: 1 }} />
    </div>
  );
}

// --- ExcalidrawEditor (JSON textarea fallback) ---

interface ExcalidrawEditorProps {
  readonly path: string;
  readonly content: string;
  readonly onChange: (content: string) => void;
  readonly onSave: () => void;
  readonly children?: ReactNode;
}

export function ExcalidrawEditor({ content, onChange, onSave }: ExcalidrawEditorProps): React.ReactElement {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        onSave();
      }
    },
    [onSave],
  );

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          flex: 1,
          background: "#1e1e1e",
          color: "#d4d4d4",
          border: "none",
          padding: "16px",
          fontFamily: "monospace",
          fontSize: "14px",
          resize: "none",
          outline: "none",
        }}
      />
    </div>
  );
}

// --- EmptyEditor ---

interface EmptyEditorProps {
  readonly message: string;
  readonly children?: ReactNode;
}

export function EmptyEditor({ message }: EmptyEditorProps): React.ReactElement {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#888", fontSize: "14px" }}>
      {message}
    </div>
  );
}

// --- ErrorDisplay ---

interface ErrorDisplayProps {
  readonly error: string;
  readonly onDismiss: () => void;
  readonly children?: ReactNode;
}

export function ErrorDisplay({ error, onDismiss }: ErrorDisplayProps): React.ReactElement {
  return (
    <div
      style={{
        position: "fixed",
        top: "16px",
        right: "16px",
        background: "#5a1d1d",
        border: "1px solid #be1100",
        padding: "12px 16px",
        borderRadius: "4px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        zIndex: 1000,
      }}
    >
      <span>{error}</span>
      <button
        onClick={() => onDismiss()}
        style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: "16px" }}
      >
        &times;
      </button>
    </div>
  );
}
