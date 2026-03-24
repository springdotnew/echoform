import { useEffect, useState, useMemo, useCallback, useRef, type ReactElement } from "react";
import { Command } from "cmdk";
import { Search } from "lucide-react";
import { resolveIcon } from "../utils/icons";
import type { CategoryInfo } from "../types";

interface CommandPaletteProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly categories: ReadonlyArray<CategoryInfo>;
  readonly activeTabId: string;
  readonly onSelectCategory: (name: string) => void;
  readonly onSelectTab: (id: string) => void;
  readonly onStartProcess: (id: string) => void;
  readonly onStopProcess: (id: string) => void;
  readonly onRestartProcess: (id: string) => void;
  readonly onOpenFile: (path: string) => void;
}

const GROUP_HEADING_CLASS = "[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:text-muted-foreground/40 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:font-medium";
const ITEM_CLASS = "flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] text-foreground/80 cursor-pointer data-[selected=true]:bg-background/80 data-[selected=true]:text-foreground transition-colors";

function filterMatch(value: string, searchTerm: string): number {
  return value.toLowerCase().includes(searchTerm.toLowerCase()) ? 1 : 0;
}

interface FileWithCategory {
  readonly path: string;
  readonly name: string;
  readonly category: string;
}

function extractSearchableFiles(categories: ReadonlyArray<CategoryInfo>): readonly FileWithCategory[] {
  return categories
    .filter((category) => category.type === "files" && category.fileEntries && category.fileEntries.length > 0)
    .flatMap((category) =>
      (category.fileEntries ?? [])
        .filter((entry) => !entry.isDir)
        .map((entry) => ({ path: entry.path, name: entry.name, category: category.name })),
    );
}

function findActiveTab(categories: ReadonlyArray<CategoryInfo>, activeTabId: string) {
  for (const category of categories) {
    const tab = category.tabs.find((t) => t.id === activeTabId);
    if (tab) return tab;
  }
  return null;
}

function CategoryIcon({ icon, color }: { readonly icon?: string | undefined; readonly color: string }): ReactElement {
  const Icon = resolveIcon(icon);
  if (Icon) return <Icon size={13} className="text-muted-foreground/60 shrink-0" />;
  return <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: color }} />;
}

function selectAndClose(action: () => void, onClose: () => void): void {
  action();
  onClose();
}

function CategoriesGroup({
  categories,
  onSelectCategory,
  onClose,
}: {
  readonly categories: ReadonlyArray<CategoryInfo>;
  readonly onSelectCategory: (name: string) => void;
  readonly onClose: () => void;
}): ReactElement {
  return (
    <Command.Group heading="Categories" className={GROUP_HEADING_CLASS}>
      {categories.map((category) => (
        <Command.Item
          key={`cat-${category.name}`}
          value={`category ${category.name}`}
          onSelect={() => selectAndClose(() => onSelectCategory(category.name), onClose)}
          className={ITEM_CLASS}
        >
          <CategoryIcon icon={category.icon} color={category.color} />
          <span className="flex-1">{category.name}</span>
          <span className="text-[10px] text-muted-foreground/30">
            {category.type === "files" ? "files" : `${category.tabs.length} tabs`}
          </span>
        </Command.Item>
      ))}
    </Command.Group>
  );
}

function ProcessesGroup({
  categories,
  onSelectCategory,
  onSelectTab,
  onClose,
}: {
  readonly categories: ReadonlyArray<CategoryInfo>;
  readonly onSelectCategory: (name: string) => void;
  readonly onSelectTab: (id: string) => void;
  readonly onClose: () => void;
}): ReactElement | null {
  const processCats = categories.filter((c) => c.type === "process");
  if (processCats.length === 0) return null;

  return (
    <Command.Group heading="Processes" className={GROUP_HEADING_CLASS}>
      {processCats.flatMap((category) =>
        category.tabs.map((tab) => (
          <Command.Item
            key={`tab-${tab.id}`}
            value={`process ${tab.name} ${category.name} ${tab.description ?? ""}`}
            onSelect={() => selectAndClose(() => { onSelectCategory(category.name); onSelectTab(tab.id); }, onClose)}
            className={ITEM_CLASS}
          >
            <CategoryIcon icon={tab.icon} color={category.color} />
            <span className="flex-1">{tab.name}</span>
            <span className="text-[10px] text-muted-foreground/30">{category.name}</span>
          </Command.Item>
        )),
      )}
    </Command.Group>
  );
}

function FilesGroup({
  files,
  onSelectCategory,
  onSelectTab,
  onOpenFile,
  onClose,
}: {
  readonly files: readonly FileWithCategory[];
  readonly onSelectCategory: (name: string) => void;
  readonly onSelectTab: (id: string) => void;
  readonly onOpenFile: (path: string) => void;
  readonly onClose: () => void;
}): ReactElement | null {
  if (files.length === 0) return null;

  return (
    <Command.Group heading="Files" className={GROUP_HEADING_CLASS}>
      {files.map((file) => (
        <Command.Item
          key={`file-${file.path}`}
          value={`file ${file.name} ${file.path} ${file.category}`}
          onSelect={() => selectAndClose(() => { onSelectCategory(file.category); onSelectTab(`file::${file.path}`); onOpenFile(file.path); }, onClose)}
          className={ITEM_CLASS}
        >
          <span className="text-muted-foreground/40 text-[12px]">📄</span>
          <span className="flex-1 truncate">{file.name}</span>
          <span className="text-[10px] text-muted-foreground/30 truncate max-w-[140px]">{file.category}</span>
        </Command.Item>
      ))}
    </Command.Group>
  );
}

function ActionsGroup({
  activeTab,
  activeTabId,
  onStartProcess,
  onStopProcess,
  onRestartProcess,
  onClose,
}: {
  readonly activeTab: { readonly name: string; readonly status: string };
  readonly activeTabId: string;
  readonly onStartProcess: (id: string) => void;
  readonly onStopProcess: (id: string) => void;
  readonly onRestartProcess: (id: string) => void;
  readonly onClose: () => void;
}): ReactElement {
  const isRunning = activeTab.status === "running";

  return (
    <Command.Group heading="Actions" className={GROUP_HEADING_CLASS}>
      {!isRunning && (
        <Command.Item value="start process" onSelect={() => selectAndClose(() => onStartProcess(activeTabId), onClose)} className={ITEM_CLASS}>
          <span className="text-success">Start</span><span className="text-muted-foreground/40">{activeTab.name}</span>
        </Command.Item>
      )}
      {isRunning && (
        <>
          <Command.Item value="restart process" onSelect={() => selectAndClose(() => onRestartProcess(activeTabId), onClose)} className={ITEM_CLASS}>
            <span className="text-warning">Restart</span><span className="text-muted-foreground/40">{activeTab.name}</span>
          </Command.Item>
          <Command.Item value="stop process" onSelect={() => selectAndClose(() => onStopProcess(activeTabId), onClose)} className={ITEM_CLASS}>
            <span className="text-destructive">Stop</span><span className="text-muted-foreground/40">{activeTab.name}</span>
          </Command.Item>
        </>
      )}
    </Command.Group>
  );
}

export function CommandPalette({
  open,
  onOpenChange,
  categories,
  activeTabId,
  onSelectCategory,
  onSelectTab,
  onStartProcess,
  onStopProcess,
  onRestartProcess,
  onOpenFile,
}: CommandPaletteProps): ReactElement | null {
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setSearch("");
    }
  }, [open]);

  const activeTab = useMemo(() => findActiveTab(categories, activeTabId), [categories, activeTabId]);
  const allFiles = useMemo(() => extractSearchableFiles(categories), [categories]);
  const closePalette = useCallback(() => onOpenChange(false), [onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" onClick={closePalette}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-[520px] rounded-xl border border-border/60 bg-card shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <Command className="[&_[cmdk-root]]:bg-transparent" filter={filterMatch}>
          <div className="flex items-center gap-2 px-3 border-b border-border/40">
            <Search size={14} className="text-muted-foreground/50 shrink-0" />
            <Command.Input
              ref={inputRef}
              value={search}
              onValueChange={setSearch}
              placeholder="Type a command or search..."
              className="flex-1 bg-transparent border-none outline-none text-[13px] text-foreground placeholder:text-muted-foreground/40 py-3 font-sans"
              autoFocus
            />
            <kbd className="text-[10px] text-muted-foreground/30 bg-background/50 px-1.5 py-0.5 rounded border border-border/30 font-mono">esc</kbd>
          </div>
          <Command.List className="max-h-[320px] overflow-y-auto p-1.5">
            <Command.Empty className="py-6 text-center text-[13px] text-muted-foreground/50">No results found.</Command.Empty>

            <CategoriesGroup categories={categories} onSelectCategory={onSelectCategory} onClose={closePalette} />
            <ProcessesGroup categories={categories} onSelectCategory={onSelectCategory} onSelectTab={onSelectTab} onClose={closePalette} />
            <FilesGroup files={allFiles} onSelectCategory={onSelectCategory} onSelectTab={onSelectTab} onOpenFile={onOpenFile} onClose={closePalette} />
            {activeTab && (
              <ActionsGroup
                activeTab={activeTab}
                activeTabId={activeTabId}
                onStartProcess={onStartProcess}
                onStopProcess={onStopProcess}
                onRestartProcess={onRestartProcess}
                onClose={closePalette}
              />
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
