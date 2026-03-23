import React, { useEffect, useState, useMemo } from "react";
import { Command } from "cmdk";
import { Search } from "lucide-react";
import { resolveIcon } from "../utils/icons";

interface CategoryInfo {
  readonly name: string;
  readonly color: string;
  readonly icon?: string;
  readonly type: string;
  readonly tabs: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly description?: string;
    readonly icon?: string;
    readonly status: string;
  }>;
}

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
}: CommandPaletteProps): React.ReactElement | null {
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const activeTab = useMemo(() => {
    for (const cat of categories) {
      const tab = cat.tabs.find((t) => t.id === activeTabId);
      if (tab) return tab;
    }
    return null;
  }, [categories, activeTabId]);

  if (!open) return null;

  const processCats = categories.filter((c) => c.type === "process");

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" onClick={() => onOpenChange(false)}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-[520px] rounded-xl border border-border/60 bg-card shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <Command
          className="[&_[cmdk-root]]:bg-transparent"
          filter={(value, search) => value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0}
        >
          <div className="flex items-center gap-2 px-3 border-b border-border/40">
            <Search size={14} className="text-muted-foreground/50 shrink-0" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Type a command or search..."
              className="flex-1 bg-transparent border-none outline-none text-[13px] text-foreground placeholder:text-muted-foreground/40 py-3 font-sans"
            />
            <kbd className="text-[10px] text-muted-foreground/30 bg-background/50 px-1.5 py-0.5 rounded border border-border/30 font-mono">esc</kbd>
          </div>
          <Command.List className="max-h-[320px] overflow-y-auto p-1.5">
            <Command.Empty className="py-6 text-center text-[13px] text-muted-foreground/50">No results found.</Command.Empty>

            <Command.Group heading="Categories" className="[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:text-muted-foreground/40 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:font-medium">
              {categories.map((cat) => {
                const Icon = resolveIcon(cat.icon);
                return (
                  <Command.Item
                    key={`cat-${cat.name}`}
                    value={`category ${cat.name}`}
                    onSelect={() => { onSelectCategory(cat.name); onOpenChange(false); }}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] text-foreground/80 cursor-pointer data-[selected=true]:bg-background/80 data-[selected=true]:text-foreground transition-colors"
                  >
                    {Icon ? <Icon size={13} className="text-muted-foreground/60 shrink-0" /> : <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: cat.color }} />}
                    <span className="flex-1">{cat.name}</span>
                    <span className="text-[10px] text-muted-foreground/30">{cat.type === "files" ? "files" : `${cat.tabs.length} tabs`}</span>
                  </Command.Item>
                );
              })}
            </Command.Group>

            {processCats.length > 0 && (
              <Command.Group heading="Processes" className="[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:text-muted-foreground/40 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:font-medium">
                {processCats.flatMap((cat) =>
                  cat.tabs.map((tab) => {
                    const Icon = resolveIcon(tab.icon);
                    return (
                      <Command.Item
                        key={`tab-${tab.id}`}
                        value={`process ${tab.name} ${cat.name} ${tab.description ?? ""}`}
                        onSelect={() => { onSelectCategory(cat.name); onSelectTab(tab.id); onOpenChange(false); }}
                        className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] text-foreground/80 cursor-pointer data-[selected=true]:bg-background/80 data-[selected=true]:text-foreground transition-colors"
                      >
                        {Icon ? <Icon size={13} className="text-muted-foreground/60 shrink-0" /> : <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cat.color }} />}
                        <span className="flex-1">{tab.name}</span>
                        <span className="text-[10px] text-muted-foreground/30">{cat.name}</span>
                      </Command.Item>
                    );
                  }),
                )}
              </Command.Group>
            )}

            {activeTab && (
              <Command.Group heading="Actions" className="[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:text-muted-foreground/40 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:font-medium">
                {activeTab.status !== "running" && (
                  <Command.Item value="start process" onSelect={() => { onStartProcess(activeTabId); onOpenChange(false); }} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] text-foreground/80 cursor-pointer data-[selected=true]:bg-background/80 data-[selected=true]:text-foreground transition-colors">
                    <span className="text-success">Start</span><span className="text-muted-foreground/40">{activeTab.name}</span>
                  </Command.Item>
                )}
                {activeTab.status === "running" && (
                  <>
                    <Command.Item value="restart process" onSelect={() => { onRestartProcess(activeTabId); onOpenChange(false); }} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] text-foreground/80 cursor-pointer data-[selected=true]:bg-background/80 data-[selected=true]:text-foreground transition-colors">
                      <span className="text-warning">Restart</span><span className="text-muted-foreground/40">{activeTab.name}</span>
                    </Command.Item>
                    <Command.Item value="stop process" onSelect={() => { onStopProcess(activeTabId); onOpenChange(false); }} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] text-foreground/80 cursor-pointer data-[selected=true]:bg-background/80 data-[selected=true]:text-foreground transition-colors">
                      <span className="text-destructive">Stop</span><span className="text-muted-foreground/40">{activeTab.name}</span>
                    </Command.Item>
                  </>
                )}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
