import React, { useState, useEffect, useRef } from "react";
import { useViews } from "@playfast/echoform/server";
import { views } from "../views";
import type { ManagedProcess } from "../process";
import type { ProcessStatus } from "../types";
import { TerminalSession } from "./TerminalSession";
import { IframeSession } from "./IframeSession";
import { FileViewerSession, type FileViewerActions, type FileViewerState } from "./FileViewerSession";

// ── Helpers ──

const CATEGORY_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f97316", "#14b8a6",
  "#eab308", "#06b6d4", "#f43f5e", "#84cc16", "#a855f7",
];

function categoryColor(name: string | undefined): string {
  const str = name ?? "default";
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  return CATEGORY_COLORS[Math.abs(hash) % CATEGORY_COLORS.length]!;
}

// ── Types ──

interface TabDef {
  readonly id: string;
  readonly description?: string;
  readonly icon?: string;
  readonly tabType: "process" | "iframe";
  readonly url?: string;
}

interface CategoryDef {
  readonly name: string;
  readonly icon?: string;
  readonly type: "process" | "files";
  readonly tabs: readonly TabDef[];
  readonly fileRoot?: string;
}

interface WmuxRootProps {
  readonly processes: ReadonlyMap<string, ManagedProcess>;
  readonly categoryDefs: readonly CategoryDef[];
}

// ── Component ──

export function WmuxRoot({ processes, categoryDefs }: WmuxRootProps): React.ReactElement | null {
  const View = useViews(views);
  const [activeCategory, setActiveCategory] = useState(categoryDefs[0]?.name ?? "");
  const [activeTabId, setActiveTabId] = useState("");
  const [statuses, setStatuses] = useState<Record<string, ProcessStatus>>({});
  const [fileStates, setFileStates] = useState<Record<string, FileViewerState>>({});

  // File viewer action refs (one per file category)
  const fileRefs = useRef<Record<string, React.RefObject<FileViewerActions | null>>>({});
  for (const def of categoryDefs) {
    if (def.type === "files" && !fileRefs.current[def.name]) {
      fileRefs.current[def.name] = React.createRef<FileViewerActions | null>();
    }
  }

  // Stable per-category state handlers (avoid recreating on every render)
  const stateHandlersRef = useRef<Record<string, (s: FileViewerState) => void>>({});
  const getStateHandler = (name: string) => {
    if (!stateHandlersRef.current[name]) {
      stateHandlersRef.current[name] = (s: FileViewerState) =>
        setFileStates((prev) => ({ ...prev, [name]: s }));
    }
    return stateHandlersRef.current[name]!;
  };

  // Poll process statuses
  const statusRef = useRef(statuses);
  useEffect(() => {
    const interval = setInterval(() => {
      let changed = false;
      const next: Record<string, ProcessStatus> = {};
      for (const [id, proc] of processes) {
        next[id] = proc.status;
        if (proc.status !== statusRef.current[id]) changed = true;
      }
      if (changed) { statusRef.current = next; setStatuses(next); }
    }, 200);
    return () => clearInterval(interval);
  }, [processes]);

  if (!View) return null;

  // Build categories
  const categories = categoryDefs.map((def) => {
    if (def.type === "files") {
      const fs = fileStates[def.name];
      return {
        name: def.name, color: categoryColor(def.name), icon: def.icon,
        type: "files" as const,
        tabs: [] as { id: string; name: string; description?: string; icon?: string; status: "idle" }[],
        fileEntries: fs?.entries ?? [],
        openFiles: [...(fs?.openFiles ?? [])],
      };
    }
    return {
      name: def.name, color: categoryColor(def.name), icon: def.icon,
      type: "process" as const,
      tabs: def.tabs.map((tab) => ({
        id: tab.id,
        name: tab.id.split("/").pop()!,
        description: tab.description,
        icon: tab.icon,
        status: tab.tabType === "iframe" ? ("running" as const) : (statuses[tab.id] ?? ("idle" as const)),
      })),
    };
  });

  return (
    <View.WmuxApp
      categories={categories}
      activeCategory={activeCategory}
      activeTabId={activeTabId}
      onSelectCategory={(cat) => {
        setActiveCategory(cat);
        const def = categoryDefs.find((d) => d.name === cat);
        if (!def) return;
        if (def.type === "files") {
          const open = fileStates[cat]?.openFiles ?? [];
          setActiveTabId(open.length > 0 ? `file::${open[0]!.path}` : "");
        } else if (def.tabs.length > 0) {
          setActiveTabId(def.tabs[0]!.id);
        }
      }}
      onSelectTab={setActiveTabId}
      onStartProcess={(id) => processes.get(id)?.start()}
      onStopProcess={(id) => processes.get(id)?.stop()}
      onRestartProcess={(id) => processes.get(id)?.restart()}
      onToggleDir={(path) => fileRefs.current[activeCategory]?.current?.toggleDir(path)}
      onOpenFile={(path) => fileRefs.current[activeCategory]?.current?.openFile(path)}
      onCloseFile={(id) => fileRefs.current[activeCategory]?.current?.closeFile(id)}
    >
      {[...processes.keys()].map((id) => (
        <TerminalSession key={id} proc={processes.get(id)!} />
      ))}
      {categoryDefs.flatMap((def) =>
        def.tabs.filter((t) => t.tabType === "iframe" && t.url).map((t) => (
          <IframeSession key={t.id} id={t.id} name={t.id.split("/").pop()!} url={t.url!} />
        )),
      )}
      {categoryDefs.filter((d) => d.type === "files" && d.fileRoot).map((def) => (
        <FileViewerSession
          key={def.name}
          ref={fileRefs.current[def.name]!}
          root={def.fileRoot!}
          onStateChange={getStateHandler(def.name)}
          onActiveTabChange={setActiveTabId}
        />
      ))}
    </View.WmuxApp>
  );
}
