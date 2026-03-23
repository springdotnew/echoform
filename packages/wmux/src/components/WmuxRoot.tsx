import React, { useState, useEffect, useRef } from "react";
import { useViews } from "@playfast/echoform/server";
import { views } from "../views";
import type { ManagedProcess } from "../process";
import type { ProcessStatus } from "../types";
import { TerminalSession } from "./TerminalSession";

// Deterministic color per category
const CATEGORY_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f97316", "#14b8a6",
  "#eab308", "#06b6d4", "#f43f5e", "#84cc16", "#a855f7",
];

function categoryColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return CATEGORY_COLORS[Math.abs(hash) % CATEGORY_COLORS.length]!;
}

interface CategoryDef {
  readonly name: string;
  readonly tabIds: readonly string[];
}

interface WmuxRootProps {
  readonly processes: ReadonlyMap<string, ManagedProcess>;
  readonly categoryDefs: readonly CategoryDef[];
}

export function WmuxRoot({ processes, categoryDefs }: WmuxRootProps): React.ReactElement | null {
  const View = useViews(views);
  const [activeCategory, setActiveCategory] = useState(categoryDefs[0]?.name ?? "");
  const [activeTabId, setActiveTabId] = useState("");
  const [statuses, setStatuses] = useState<Record<string, ProcessStatus>>({});

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

  const categories = categoryDefs.map((def) => ({
    name: def.name,
    color: categoryColor(def.name),
    tabs: def.tabIds.map((id) => {
      const proc = processes.get(id)!;
      return {
        id,
        name: proc.name,
        status: statuses[id] ?? ("idle" as const),
      };
    }),
  }));

  return (
    <View.WmuxApp
      categories={categories}
      activeCategory={activeCategory}
      activeTabId={activeTabId}
      onSelectCategory={(cat) => {
        setActiveCategory(cat);
        // Auto-select first tab of the new category
        const catDef = categoryDefs.find((d) => d.name === cat);
        if (catDef && catDef.tabIds.length > 0) {
          setActiveTabId(catDef.tabIds[0]!);
        }
      }}
      onSelectTab={setActiveTabId}
      onStartProcess={(id) => processes.get(id)?.start()}
      onStopProcess={(id) => processes.get(id)?.stop()}
      onRestartProcess={(id) => processes.get(id)?.restart()}
    >
      {[...processes.keys()].map((id) => (
        <TerminalSession key={id} proc={processes.get(id)!} />
      ))}
    </View.WmuxApp>
  );
}
