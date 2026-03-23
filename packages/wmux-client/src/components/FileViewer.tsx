import React, { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, File, Folder, X, ArrowLeft } from "lucide-react";

interface FileEntry {
  readonly path: string;
  readonly name: string;
  readonly isDir: boolean;
  readonly depth: number;
  readonly isExpanded: boolean;
}

interface FileViewerProps {
  readonly entries: ReadonlyArray<FileEntry>;
  readonly selectedPath: string;
  readonly selectedContent: string;
  readonly onToggleDir: { readonly mutate: (path: string) => void };
  readonly onSelectFile: { readonly mutate: (path: string) => void };
  readonly children?: React.ReactNode;
}

const EXT_COLORS: Record<string, string> = {
  ts: "#3178c6", tsx: "#3178c6", js: "#f7df1e", jsx: "#f7df1e",
  json: "#a1a1aa", md: "#a1a1aa", css: "#264de4", html: "#e44d26",
  py: "#3572A5", rs: "#dea584", go: "#00ADD8", rb: "#CC342D",
  yaml: "#cb171e", yml: "#cb171e", toml: "#9c4221", sh: "#89e051",
  sql: "#e38c00", graphql: "#e10098", proto: "#a1a1aa",
};

function extColor(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_COLORS[ext] ?? "#71717a";
}

function FileTree({
  entries,
  onToggleDir,
  onSelectFile,
}: {
  readonly entries: ReadonlyArray<FileEntry>;
  readonly onToggleDir: (path: string) => void;
  readonly onSelectFile: (path: string) => void;
}): React.ReactElement {
  return (
    <div className="flex flex-col py-1">
      {entries.map((entry) => (
        <button
          key={entry.path}
          onClick={() => entry.isDir ? onToggleDir(entry.path) : onSelectFile(entry.path)}
          className="flex items-center gap-1.5 py-[3px] pr-2 text-left bg-transparent border-none cursor-pointer text-[12px] leading-tight hover:bg-card/80 transition-colors text-muted-foreground hover:text-foreground/80 group"
          style={{ paddingLeft: `${entry.depth * 14 + 8}px` }}
        >
          {entry.isDir ? (
            <>
              <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0 text-muted-foreground/40">
                {entry.isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              </span>
              <Folder size={13} className="shrink-0 text-muted-foreground/50" />
            </>
          ) : (
            <>
              <span className="w-3.5 h-3.5 shrink-0" />
              <File size={13} className="shrink-0" style={{ color: extColor(entry.name) }} />
            </>
          )}
          <span className="truncate">{entry.name}</span>
        </button>
      ))}
      {entries.length === 0 && (
        <div className="px-4 py-6 text-[11px] text-muted-foreground/30 text-center">
          No files
        </div>
      )}
    </div>
  );
}

function FileContent({
  path,
  content,
  onBack,
}: {
  readonly path: string;
  readonly content: string;
  readonly onBack: () => void;
}): React.ReactElement {
  const fileName = path.split("/").pop() ?? path;
  const lines = content.split("\n");

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border/30 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center justify-center w-5 h-5 rounded bg-transparent border-none text-muted-foreground/50 hover:text-foreground/80 cursor-pointer transition-colors"
        >
          <ArrowLeft size={12} />
        </button>
        <File size={12} style={{ color: extColor(fileName) }} className="shrink-0" />
        <span className="text-[11px] text-foreground/70 truncate">{fileName}</span>
      </div>
      <div className="flex-1 overflow-auto font-mono text-[11px] leading-[18px]">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="hover:bg-card/40">
                <td className="text-right pr-3 pl-2 text-muted-foreground/20 select-none w-[1%] whitespace-nowrap">
                  {i + 1}
                </td>
                <td className="pr-4 text-foreground/70 whitespace-pre">{line}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function FileViewer(props: FileViewerProps): React.ReactElement {
  const { entries, selectedPath, selectedContent } = props;
  const toggleDir = props.onToggleDir.mutate;
  const selectFile = props.onSelectFile.mutate;
  const [viewing, setViewing] = useState(false);

  const showContent = viewing && selectedPath !== "";

  return (
    <div className="h-full flex flex-col">
      {showContent ? (
        <FileContent
          path={selectedPath}
          content={selectedContent}
          onBack={() => setViewing(false)}
        />
      ) : (
        <div className="flex-1 overflow-y-auto">
          <FileTree
            entries={entries}
            onToggleDir={toggleDir}
            onSelectFile={(path) => {
              selectFile(path);
              setViewing(true);
            }}
          />
        </div>
      )}
    </div>
  );
}
