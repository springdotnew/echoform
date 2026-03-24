import type { ReactElement, ReactNode } from "react";
import Editor from "@monaco-editor/react";

interface WmuxFileContentProps {
  readonly id: string;
  readonly path: string;
  readonly name: string;
  readonly content: string;
  readonly children?: ReactNode;
}

const EXT_TO_LANG: Record<string, string> = {
  ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
  json: "json", md: "markdown", css: "css", html: "html", xml: "xml",
  py: "python", rs: "rust", go: "go", rb: "ruby", java: "java",
  yaml: "yaml", yml: "yaml", toml: "ini", sh: "shell", bash: "shell",
  sql: "sql", graphql: "graphql", proto: "protobuf", c: "c", cpp: "cpp",
  h: "c", hpp: "cpp", cs: "csharp", swift: "swift", kt: "kotlin",
  lua: "lua", r: "r", php: "php", dart: "dart", scala: "scala",
  dockerfile: "dockerfile", makefile: "makefile",
};

const WMUX_DARK_THEME_COLORS = {
  "editor.background": "#060607",
  "editor.foreground": "#e4e4e7",
  "editorLineNumber.foreground": "#27272a",
  "editorLineNumber.activeForeground": "#52525b",
  "editor.lineHighlightBackground": "#111113",
  "editorGutter.background": "#060607",
  "editor.selectionBackground": "#3f3f4640",
  "editorWidget.background": "#111113",
  "editorWidget.border": "#27272a",
  "input.background": "#1a1a1e",
  "input.border": "#27272a",
  "scrollbarSlider.background": "#27272a80",
  "scrollbarSlider.hoverBackground": "#3f3f46",
  "scrollbarSlider.activeBackground": "#52525b",
};

const EDITOR_OPTIONS = {
  readOnly: true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  fontSize: 13,
  fontFamily: "'JetBrainsMono Nerd Font Mono', 'Geist Mono', ui-monospace, SFMono-Regular, monospace",
  lineNumbers: "on" as const,
  renderLineHighlight: "none" as const,
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  overviewRulerBorder: false,
  scrollbar: { verticalScrollbarSize: 4, horizontalScrollbarSize: 4 },
  padding: { top: 8 },
  domReadOnly: true,
};

function detectLanguage(name: string): string {
  const lower = name.toLowerCase();
  if (lower === "dockerfile") return "dockerfile";
  if (lower === "makefile") return "makefile";
  const ext = lower.split(".").pop() ?? "";
  return EXT_TO_LANG[ext] ?? "plaintext";
}

function defineWmuxDarkTheme(monaco: Parameters<NonNullable<Parameters<typeof Editor>[0]["beforeMount"]>>[0]): void {
  monaco.editor.defineTheme("wmux-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: WMUX_DARK_THEME_COLORS,
  });
}

export function WmuxFileContent({ path, name, content }: WmuxFileContentProps): ReactElement {
  return (
    <div className="w-full h-full">
      <Editor
        value={content}
        language={detectLanguage(name)}
        path={path}
        theme="wmux-dark"
        options={EDITOR_OPTIONS}
        beforeMount={defineWmuxDarkTheme}
        loading={<div className="flex items-center justify-center h-full text-muted-foreground/30 text-[12px]">Loading...</div>}
      />
    </div>
  );
}
