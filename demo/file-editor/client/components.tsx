import React, { useState, useRef, useEffect, useCallback } from "react";
import type { InferClientProps } from "@playfast/echoform/client";
import type {
  App as AppDef,
  FileTree as FileTreeDef,
  TabBar as TabBarDef,
  CodeEditor as CodeEditorDef,
  ExcalidrawEditor as ExcalidrawEditorDef,
  EmptyEditor as EmptyEditorDef,
  ErrorDisplay as ErrorDisplayDef,
} from "../shared/views";

// --- App ---

export function App({ rootPath, title, children }: InferClientProps<typeof AppDef>): React.ReactElement {
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

interface FileTreeNodeData {
  readonly path: string;
  readonly name: string;
  readonly isDirectory: boolean;
  readonly children?: readonly FileTreeNodeData[];
}

function FileTreeNode({
  node,
  depth,
  selectedPath,
  expanded,
  onToggleExpand,
  onSelect,
}: {
  readonly node: { path: string; name: string; isDirectory: boolean; children?: readonly FileTreeNodeData[] };
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

export function FileTree(props: InferClientProps<typeof FileTreeDef>): React.ReactElement {
  const { files, selectedPath } = props;
  const selectFile = props.onSelect.mutate;
  const refreshTree = props.onRefresh.mutate;

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
          onClick={() => refreshTree()}
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
          onSelect={selectFile}
        />
      )}
    </div>
  );
}

// --- TabBar ---

export function TabBar(props: InferClientProps<typeof TabBarDef>): React.ReactElement {
  const { openFiles, activeFilePath, children } = props;
  const selectTab = props.onSelectTab.mutate;
  const closeTab = props.onCloseTab.mutate;

  if (openFiles.length === 0) return <>{children}</>;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      <div style={{ display: "flex", background: "#252526", borderBottom: "1px solid #3c3c3c", overflow: "auto", flexShrink: 0 }}>
        {openFiles.map((file) => (
          <div
            key={file.path}
            onClick={() => selectTab(file.path)}
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
              onClick={(e) => { e.stopPropagation(); closeTab(file.path); }}
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

function loadMonaco(onReady: () => void): void {
  const initMonaco = (): void => {
    window.require.config({ paths: { vs: MONACO_CDN } });
    window.require(["vs/editor/editor.main"], onReady);
  };

  if (window.require) {
    initMonaco();
    return;
  }

  const script = document.createElement("script");
  script.src = `${MONACO_CDN}/loader.js`;
  script.onload = initMonaco;
  document.head.appendChild(script);
}

function createMonacoEditor(
  container: HTMLElement,
  content: string,
  language: string,
  onChange: (value: string) => void,
  onSave: () => void,
): MonacoEditor {
  const editor = window.monaco.editor.create(container, {
    value: content, language, theme: "vs-dark",
    automaticLayout: true, minimap: { enabled: true }, fontSize: 14, tabSize: 2,
  });
  editor.onDidChangeModelContent(() => onChange(editor.getValue()));
  editor.addCommand(window.monaco.KeyMod.CtrlCmd | window.monaco.KeyCode.KeyS, onSave);
  return editor;
}

export function CodeEditor(props: InferClientProps<typeof CodeEditorDef>): React.ReactElement {
  const { path, content, language } = props;
  const change = props.onChange.mutate;
  const save = props.onSave.mutate;

  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<MonacoEditor | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadMonaco(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready || !containerRef.current) return;
    if (!editorRef.current) {
      editorRef.current = createMonacoEditor(containerRef.current, content, language, change, save);
    }
    return () => {
      editorRef.current?.dispose();
      editorRef.current = null;
    };
  }, [ready]);

  useEffect(() => {
    if (!editorRef.current) return;
    const model = editorRef.current.getModel();
    if (!model) return;

    window.monaco.editor.setModelLanguage(model, language);
    if (model.getValue() !== content) {
      model.setValue(content);
    }
  }, [path, content, language]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div ref={containerRef} style={{ flex: 1 }} />
    </div>
  );
}

// --- ExcalidrawEditor (JSON textarea fallback) ---

export function ExcalidrawEditor(props: InferClientProps<typeof ExcalidrawEditorDef>): React.ReactElement {
  const { content } = props;
  const change = props.onChange.mutate;
  const save = props.onSave.mutate;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
    },
    [save],
  );

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <textarea
        value={content}
        onChange={(e) => change(e.target.value)}
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

export function EmptyEditor({ message }: InferClientProps<typeof EmptyEditorDef>): React.ReactElement {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#888", fontSize: "14px" }}>
      {message}
    </div>
  );
}

// --- ErrorDisplay ---

export function ErrorDisplay(props: InferClientProps<typeof ErrorDisplayDef>): React.ReactElement {
  const { error } = props;
  const dismiss = props.onDismiss.mutate;

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
        onClick={() => dismiss()}
        style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: "16px" }}
      >
        &times;
      </button>
    </div>
  );
}
