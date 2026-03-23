import React, { useState, useEffect, useRef } from "react";
import { useViews } from "@playfast/echoform/server";
import { views } from "../views";
import type { ManagedProcess } from "../process";
import type { LayoutConfig, ProcessStatus } from "../types";
import { TerminalSession } from "./TerminalSession";

// Deterministic color assignment per category
const CATEGORY_COLORS = [
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f97316", // orange
  "#14b8a6", // teal
  "#eab308", // yellow
  "#06b6d4", // cyan
  "#f43f5e", // rose
  "#84cc16", // lime
  "#a855f7", // purple
];

function categoryColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return CATEGORY_COLORS[Math.abs(hash) % CATEGORY_COLORS.length]!;
}

interface WmuxRootProps {
  readonly processes: ReadonlyMap<string, ManagedProcess>;
  readonly categories: ReadonlyMap<string, string>; // processId → category
  readonly layout?: LayoutConfig;
}

export function WmuxRoot({ processes, categories, layout }: WmuxRootProps): React.ReactElement | null {
  const View = useViews(views);
  const keys = [...processes.keys()];
  const [activeId, setActiveId] = useState(keys[0] ?? "");
  const [statuses, setStatuses] = useState<Record<string, ProcessStatus>>(() =>
    Object.fromEntries(keys.map((k) => [k, "idle"])),
  );

  const statusRef = useRef(statuses);
  useEffect(() => {
    const interval = setInterval(() => {
      let changed = false;
      const next: Record<string, ProcessStatus> = {};
      for (const [id, proc] of processes) {
        next[id] = proc.status;
        if (proc.status !== statusRef.current[id]) changed = true;
      }
      if (changed) {
        statusRef.current = next;
        setStatuses(next);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [processes]);

  if (!View) return null;

  const processList = keys.map((id) => ({
    id,
    name: processes.get(id)!.name,
    status: statuses[id] ?? ("idle" as const),
    category: categories.get(id) ?? "default",
  }));

  // Derive unique categories
  const uniqueCategories = [...new Set(processList.map((p) => p.category))];
  const categoryList = uniqueCategories.map((name) => ({
    name,
    color: categoryColor(name),
    processCount: processList.filter((p) => p.category === name).length,
  }));

  return (
    <View.WmuxApp
      processes={processList}
      categories={categoryList}
      activeProcessId={activeId}
      layout={layout}
      onSelectProcess={setActiveId}
      onStartProcess={(id) => processes.get(id)?.start()}
      onStopProcess={(id) => processes.get(id)?.stop()}
      onRestartProcess={(id) => processes.get(id)?.restart()}
    >
      {keys.map((id) => (
        <TerminalSession key={id} proc={processes.get(id)!} />
      ))}
    </View.WmuxApp>
  );
}
