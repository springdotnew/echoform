import type { ReactElement } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { STATUS_COLORS } from "../styles/theme";
import { resolveIcon } from "../utils/icons";
import { FileTree } from "./FileViewer";

// ── Types ──

interface FileEntry {
  readonly path: string;
  readonly name: string;
  readonly isDir: boolean;
  readonly depth: number;
  readonly isExpanded: boolean;
}

interface TabInfo {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly icon?: string;
  readonly status: string;
}

interface CategoryInfo {
  readonly name: string;
  readonly color: string;
  readonly icon?: string;
  readonly type: string;
  readonly tabs: readonly TabInfo[];
  readonly fileEntries?: readonly FileEntry[];
  readonly openFiles?: readonly { readonly path: string; readonly name: string }[];
}

interface SidebarProps {
  readonly categories: ReadonlyArray<CategoryInfo>;
  readonly activeCategory: string;
  readonly activeTabId: string;
  readonly collapsedCategories: ReadonlySet<string>;
  readonly onSelectCategory: (name: string) => void;
  readonly onToggleCollapse: (name: string) => void;
  readonly onSelectTab: (id: string) => void;
  readonly onToggleDir: (path: string) => void;
  readonly onOpenFile: (path: string) => void;
}

// ── Category header ──

function CategoryHeader({
  category,
  isActive,
  isCollapsed,
  onSelect,
  onToggle,
}: {
  readonly category: CategoryInfo;
  readonly isActive: boolean;
  readonly isCollapsed: boolean;
  readonly onSelect: () => void;
  readonly onToggle: () => void;
}): ReactElement {
  const CatIcon = resolveIcon(category.icon);
  const isFiles = category.type === "files";
  const count = isFiles ? (category.openFiles?.length ?? 0) : category.tabs.length;

  return (
    <div
      onClick={() => { onSelect(); if (isCollapsed) onToggle(); }}
      className={`flex items-center gap-1.5 px-2 py-1.5 text-xs cursor-pointer transition-colors group relative ${
        isActive
          ? "text-foreground/90"
          : "text-muted-foreground/50 hover:text-muted-foreground/70"
      }`}
    >
      <span
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className="flex items-center justify-center w-3.5 h-3.5 cursor-pointer shrink-0 text-muted-foreground/40"
      >
        {isCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
      </span>

      <span
        className="w-2 h-2 rounded-sm shrink-0 transition-opacity"
        style={{ background: category.color, opacity: isActive ? 1 : 0.4 }}
      />

      <span className="lowercase tracking-wide font-medium flex-1 truncate text-[12px]">
        {category.name}
      </span>

      <span className="text-[10px] text-muted-foreground/30 tabular-nums pr-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {count}
      </span>
    </div>
  );
}

// ── Tab item ──

function TabItem({
  tab,
  isActive,
  onSelect,
}: {
  readonly tab: TabInfo;
  readonly isActive: boolean;
  readonly onSelect: () => void;
}): ReactElement {
  const TabIcon = resolveIcon(tab.icon);

  return (
    <div
      onClick={onSelect}
      className={`flex items-center gap-2.5 pl-5 pr-2 py-[7px] cursor-pointer transition-colors rounded-sm mx-1 relative group ${
        isActive
          ? "bg-border/20 text-foreground"
          : "text-muted-foreground/50 hover:bg-border/10 hover:text-foreground/70"
      }`}
    >
      {isActive && (
        <div className="absolute left-0.5 top-1.5 bottom-1.5 w-0.5 bg-foreground/20 rounded-r" />
      )}

      {TabIcon
        ? <TabIcon size={14} className="shrink-0" />
        : <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: STATUS_COLORS[tab.status] ?? "#3f3f46" }} />
      }

      <div className="flex-1 min-w-0">
        <div className="text-[13px] leading-snug truncate">{tab.name}</div>
        {tab.description && (
          <div className="text-[10px] leading-snug text-muted-foreground/30 truncate mt-0.5">
            {tab.description}
          </div>
        )}
      </div>

      {TabIcon && (
        <span
          className="w-[6px] h-[6px] rounded-full shrink-0"
          style={{ background: STATUS_COLORS[tab.status] ?? "#3f3f46" }}
        />
      )}
    </div>
  );
}

// ── Category section ──

function CategorySection({
  category,
  isActive,
  isCollapsed,
  activeTabId,
  onSelectCategory,
  onToggleCollapse,
  onSelectTab,
  onToggleDir,
  onOpenFile,
}: {
  readonly category: CategoryInfo;
  readonly isActive: boolean;
  readonly isCollapsed: boolean;
  readonly activeTabId: string;
  readonly onSelectCategory: () => void;
  readonly onToggleCollapse: () => void;
  readonly onSelectTab: (id: string) => void;
  readonly onToggleDir: (path: string) => void;
  readonly onOpenFile: (path: string) => void;
}): ReactElement {
  const isFiles = category.type === "files";

  return (
    <div className="border-b border-border/10 last:border-b-0">
      <CategoryHeader
        category={category}
        isActive={isActive}
        isCollapsed={isCollapsed}
        onSelect={onSelectCategory}
        onToggle={onToggleCollapse}
      />

      {!isCollapsed && (
        <div
          className="overflow-hidden transition-all"
          style={{ maxHeight: isCollapsed ? 0 : undefined }}
        >
          {isFiles && category.fileEntries && (
            <div className="max-h-[50vh] overflow-y-auto pb-1">
              <FileTree
                entries={category.fileEntries}
                onToggleDir={(path) => { if (!isActive) onSelectCategory(); onToggleDir(path); }}
                onOpenFile={(path) => { if (!isActive) onSelectCategory(); onOpenFile(path); }}
              />
            </div>
          )}

          {!isFiles && (
            <div className="pb-1">
              {category.tabs.map((tab) => (
                <TabItem
                  key={tab.id}
                  tab={tab}
                  isActive={tab.id === activeTabId && isActive}
                  onSelect={() => { if (!isActive) onSelectCategory(); onSelectTab(tab.id); }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sidebar footer ──

function SidebarFooter(): ReactElement {
  const shortcuts = [
    { key: "⌘K", label: "Command palette" },
    { key: "⌘1-9", label: "Switch category" },
    { key: "⌘[]", label: "Switch tab" },
  ] as const;

  return (
    <div className="border-t border-border/20 p-2 flex flex-col gap-1">
      {shortcuts.map(({ key, label }) => (
        <div key={key} className="flex items-center gap-1.5 text-[10px] text-muted-foreground/25">
          <kbd className="bg-muted/30 px-1 py-px rounded border border-border/15 font-mono text-[9px]">
            {key}
          </kbd>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Sidebar ──

export function Sidebar({
  categories,
  activeCategory,
  activeTabId,
  collapsedCategories,
  onSelectCategory,
  onToggleCollapse,
  onSelectTab,
  onToggleDir,
  onOpenFile,
}: SidebarProps): ReactElement {
  return (
    <div className="w-[200px] min-w-[200px] bg-background border-r border-border/30 flex flex-col select-none h-full">
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {categories.map((cat) => (
          <CategorySection
            key={cat.name}
            category={cat}
            isActive={cat.name === activeCategory}
            isCollapsed={collapsedCategories.has(cat.name)}
            activeTabId={activeTabId}
            onSelectCategory={() => onSelectCategory(cat.name)}
            onToggleCollapse={() => onToggleCollapse(cat.name)}
            onSelectTab={onSelectTab}
            onToggleDir={onToggleDir}
            onOpenFile={onOpenFile}
          />
        ))}

        {categories.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground/40 text-xs">
            <span>No categories</span>
          </div>
        )}
      </div>

      <SidebarFooter />
    </div>
  );
}
