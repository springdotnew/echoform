import type { ReactElement } from "react";
import { ChevronRight, ChevronDown, File, Folder } from "lucide-react";

interface FileEntry {
  readonly path: string;
  readonly name: string;
  readonly isDir: boolean;
  readonly depth: number;
  readonly isExpanded: boolean;
}

const EXT_COLORS: Record<string, string> = {
  ts: "#3178c6", tsx: "#3178c6", js: "#f7df1e", jsx: "#f7df1e",
  json: "#a1a1aa", md: "#a1a1aa", css: "#264de4", html: "#e44d26",
  py: "#3572A5", rs: "#dea584", go: "#00ADD8", sh: "#89e051",
};

function extColor(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_COLORS[ext] ?? "#71717a";
}

export function FileTree({
  entries,
  onToggleDir,
  onOpenFile,
}: {
  readonly entries: ReadonlyArray<FileEntry>;
  readonly onToggleDir: (path: string) => void;
  readonly onOpenFile: (path: string) => void;
}): ReactElement {
  return (
    <div className="flex flex-col py-0.5">
      {entries.map((entry) => (
        <button
          key={entry.path}
          onClick={() => entry.isDir ? onToggleDir(entry.path) : onOpenFile(entry.path)}
          className="flex items-center gap-1.5 py-[3px] pr-2 text-left bg-transparent border-none cursor-pointer text-[12px] leading-tight hover:bg-card/60 transition-colors text-muted-foreground/60 hover:text-foreground/70"
          style={{ paddingLeft: `${entry.depth * 12 + 8}px` }}
        >
          {entry.isDir ? (
            <>
              <span className="w-3 h-3 flex items-center justify-center shrink-0 text-muted-foreground/30">
                {entry.isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              </span>
              <Folder size={12} className="shrink-0 text-muted-foreground/40" />
            </>
          ) : (
            <>
              <span className="w-3 h-3 shrink-0" />
              <File size={12} className="shrink-0" style={{ color: extColor(entry.name) }} />
            </>
          )}
          <span className="truncate">{entry.name}</span>
        </button>
      ))}
      {entries.length === 0 && (
        <div className="px-4 py-4 text-[10px] text-muted-foreground/20 text-center">
          No files
        </div>
      )}
    </div>
  );
}
