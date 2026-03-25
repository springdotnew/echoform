import { createRef, useState, useEffect, useRef, useMemo, useCallback, type RefObject, type ReactElement } from "react";
import { WmuxApp } from "../views";
import type { ManagedProcess } from "../process";
import type { ProcessStatus } from "../types";
import { TerminalSession } from "./TerminalSession";
import { IframeSession } from "./IframeSession";
import { FileViewerSession, type FileViewerActions, type FileViewerState } from "./FileViewerSession";

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

interface TabDef {
  readonly id: string;
  readonly description?: string | undefined;
  readonly icon?: string | undefined;
  readonly tabType: "process" | "iframe";
  readonly url?: string | undefined;
}

interface CategoryDef {
  readonly name: string;
  readonly icon?: string | undefined;
  readonly type: "process" | "files";
  readonly tabs: readonly TabDef[];
  readonly fileRoot?: string | undefined;
}

interface WmuxRootProps {
  readonly title: string;
  readonly description: string;
  readonly processes: ReadonlyMap<string, ManagedProcess>;
  readonly categoryDefs: readonly CategoryDef[];
}

function buildFileCategory(definition: CategoryDef, fileState: FileViewerState | undefined) {
  return {
    name: definition.name,
    color: categoryColor(definition.name),
    icon: definition.icon,
    type: "files" as const,
    tabs: [] as { id: string; name: string; description?: string; icon?: string; status: "idle" }[],
    fileEntries: fileState?.entries ?? [],
    openFiles: [...(fileState?.openFiles ?? [])],
  };
}

function buildProcessCategory(
  definition: CategoryDef,
  statuses: Record<string, ProcessStatus>,
) {
  return {
    name: definition.name,
    color: categoryColor(definition.name),
    icon: definition.icon,
    type: "process" as const,
    tabs: definition.tabs.map((tab) => ({
      id: tab.id,
      name: tab.id.split("/").pop()!,
      description: tab.description,
      icon: tab.icon,
      status: tab.tabType === "iframe" ? ("running" as const) : (statuses[tab.id] ?? ("idle" as const)),
    })),
  };
}

function collectProcessStatuses(processes: ReadonlyMap<string, ManagedProcess>): Record<string, ProcessStatus> {
  const result: Record<string, ProcessStatus> = {};
  for (const [id, proc] of processes) {
    result[id] = proc.status;
  }
  return result;
}

function hasStatusChanged(
  current: Record<string, ProcessStatus>,
  previous: Record<string, ProcessStatus>,
  processes: ReadonlyMap<string, ManagedProcess>,
): boolean {
  for (const [id] of processes) {
    if (current[id] !== previous[id]) return true;
  }
  return false;
}

function resolveInitialTabId(definition: CategoryDef, fileStates: Record<string, FileViewerState>): string {
  if (definition.type === "files") {
    const openFiles = fileStates[definition.name]?.openFiles ?? [];
    return openFiles.length > 0 ? `file::${openFiles[0]!.path}` : "";
  }
  return definition.tabs.length > 0 ? definition.tabs[0]!.id : "";
}

function extractIframeTabs(categoryDefs: readonly CategoryDef[]): readonly TabDef[] {
  return categoryDefs.flatMap((definition) =>
    definition.tabs.filter((tab) => tab.tabType === "iframe" && tab.url),
  );
}

export function WmuxRoot({ title, description, processes, categoryDefs }: WmuxRootProps): ReactElement {
  const [activeCategory, setActiveCategory] = useState(categoryDefs[0]?.name ?? "");
  const [activeTabId, setActiveTabId] = useState(() => {
    const firstDef = categoryDefs[0];
    return firstDef ? resolveInitialTabId(firstDef, {}) : "";
  });
  const [statuses, setStatuses] = useState<Record<string, ProcessStatus>>({});
  const [fileStates, setFileStates] = useState<Record<string, FileViewerState>>({});

  const fileRefs = useRef<Record<string, RefObject<FileViewerActions | null>>>({});
  for (const definition of categoryDefs) {
    if (definition.type === "files" && !fileRefs.current[definition.name]) {
      fileRefs.current[definition.name] = createRef<FileViewerActions | null>();
    }
  }

  const stateHandlersRef = useRef<Record<string, (s: FileViewerState) => void>>({});
  const getStateHandler = (name: string) => {
    if (!stateHandlersRef.current[name]) {
      stateHandlersRef.current[name] = (s: FileViewerState) =>
        setFileStates((prev) => ({ ...prev, [name]: s }));
    }
    return stateHandlersRef.current[name]!;
  };

  const statusRef = useRef(statuses);
  useEffect(() => {
    const interval = setInterval(() => {
      const nextStatuses = collectProcessStatuses(processes);
      if (!hasStatusChanged(nextStatuses, statusRef.current, processes)) return;
      statusRef.current = nextStatuses;
      setStatuses(nextStatuses);
    }, 200);
    return () => clearInterval(interval);
  }, [processes]);

  const categories = useMemo(
    () => categoryDefs.map((definition) => {
      if (definition.type === "files") return buildFileCategory(definition, fileStates[definition.name]);
      return buildProcessCategory(definition, statuses);
    }),
    [categoryDefs, fileStates, statuses],
  );

  const iframeTabs = useMemo(() => extractIframeTabs(categoryDefs), [categoryDefs]);
  const processIds = useMemo(() => [...processes.keys()], [processes]);
  const fileCategories = useMemo(
    () => categoryDefs.filter((d) => d.type === "files" && d.fileRoot),
    [categoryDefs],
  );

  const handleSelectCategory = useCallback((category: string) => {
    setActiveCategory(category);
    const definition = categoryDefs.find((d) => d.name === category);
    if (!definition) return;
    setActiveTabId(resolveInitialTabId(definition, fileStates));
  }, [categoryDefs, fileStates]);

  const handleStartProcess = useCallback((id: string) => processes.get(id)?.start(), [processes]);
  const handleStopProcess = useCallback((id: string) => processes.get(id)?.stop(), [processes]);
  const handleRestartProcess = useCallback((id: string) => processes.get(id)?.restart(), [processes]);
  const handleToggleDir = useCallback((path: string) => fileRefs.current[activeCategory]?.current?.toggleDir(path), [activeCategory]);
  const handleOpenFile = useCallback((path: string) => fileRefs.current[activeCategory]?.current?.openFile(path), [activeCategory]);
  const handleCloseFile = useCallback((id: string) => fileRefs.current[activeCategory]?.current?.closeFile(id), [activeCategory]);

  return (
    <WmuxApp
      title={title}
      description={description}
      categories={categories}
      activeCategory={activeCategory}
      activeTabId={activeTabId}
      onSelectCategory={handleSelectCategory}
      onSelectTab={setActiveTabId}
      onStartProcess={handleStartProcess}
      onStopProcess={handleStopProcess}
      onRestartProcess={handleRestartProcess}
      onToggleDir={handleToggleDir}
      onOpenFile={handleOpenFile}
      onCloseFile={handleCloseFile}
    >
      {processIds.map((id) => (
        <TerminalSession key={id} proc={processes.get(id)!} />
      ))}
      {iframeTabs.map((tab) => (
        <IframeSession key={tab.id} id={tab.id} name={tab.id.split("/").pop()!} url={tab.url!} />
      ))}
      {fileCategories.map((definition) => (
        <FileViewerSession
          key={definition.name}
          ref={fileRefs.current[definition.name]!}
          root={definition.fileRoot!}
          onStateChange={getStateHandler(definition.name)}
          onActiveTabChange={setActiveTabId}
        />
      ))}
    </WmuxApp>
  );
}
