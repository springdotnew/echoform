import { useCallback, type ReactElement } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { STATUS_COLORS } from "../styles/theme";
import { resolveIcon } from "../utils/icons";
import { FileTree } from "./FileViewer";
import type { CategoryInfo, TabInfo } from "../types";

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

function categoryTabCount(category: CategoryInfo): number {
  return category.type === "files" ? (category.openFiles?.length ?? 0) : category.tabs.length;
}

function selectAndExpand(isCollapsed: boolean, onSelect: () => void, onToggle: () => void): void {
  onSelect();
  if (isCollapsed) onToggle();
}

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
  const Icon = resolveIcon(category.icon);

  return (
    <div
      onClick={() => selectAndExpand(isCollapsed, onSelect, onToggle)}
      className={`flex items-center gap-2 px-3 py-2.5 text-xs cursor-pointer transition-colors group relative ${
        isActive
          ? "text-foreground bg-card/60"
          : "text-muted-foreground/70 hover:text-muted-foreground/90 hover:bg-card/30"
      }`}
    >
      <span
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className="flex items-center justify-center w-4 h-4 cursor-pointer shrink-0 text-muted-foreground/60"
      >
        {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
      </span>

      {Icon
        ? <Icon size={14} className="shrink-0 transition-opacity" style={{ color: category.color, opacity: isActive ? 1 : 0.7 }} />
        : <span className="w-2.5 h-2.5 rounded-sm shrink-0 transition-opacity" style={{ background: category.color, opacity: isActive ? 1 : 0.6 }} />
      }

      <span className="lowercase tracking-wide font-medium flex-1 truncate text-[12px]">
        {category.name}
      </span>

      <span className="text-[10px] text-muted-foreground/50 tabular-nums pr-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {categoryTabCount(category)}
      </span>
    </div>
  );
}

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
      className={`flex items-center gap-2.5 pl-7 pr-3 py-2 cursor-pointer transition-colors rounded-md mx-1.5 group ${
        isActive
          ? "bg-accent/60 text-foreground"
          : "text-muted-foreground/70 hover:bg-accent/30 hover:text-foreground/90"
      }`}
    >
      {TabIcon
        ? <TabIcon size={14} className="shrink-0" />
        : <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: STATUS_COLORS[tab.status] ?? "#3f3f46" }} />
      }

      <div className="flex-1 min-w-0">
        <div className="text-[13px] leading-snug truncate">{tab.name}</div>
        {tab.description && (
          <div className="text-[10px] leading-snug text-muted-foreground/60 truncate mt-0.5">
            {tab.description}
          </div>
        )}
      </div>

      <span
        className="w-[6px] h-[6px] rounded-full shrink-0"
        style={{ background: STATUS_COLORS[tab.status] ?? "#3f3f46" }}
      />
    </div>
  );
}

function selectCategoryAndAct(isActive: boolean, onSelectCategory: () => void, action: () => void): void {
  if (!isActive) onSelectCategory();
  action();
}

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

  const handleToggleDir = useCallback((path: string): void => {
    selectCategoryAndAct(isActive, onSelectCategory, () => onToggleDir(path));
  }, [isActive, onSelectCategory, onToggleDir]);

  const handleOpenFile = useCallback((path: string): void => {
    selectCategoryAndAct(isActive, onSelectCategory, () => onOpenFile(path));
  }, [isActive, onSelectCategory, onOpenFile]);

  const handleSelectTab = useCallback((tabId: string): void => {
    selectCategoryAndAct(isActive, onSelectCategory, () => onSelectTab(tabId));
  }, [isActive, onSelectCategory, onSelectTab]);

  return (
    <div
      className="mb-1 border-l-[3px] transition-colors"
      style={{ borderLeftColor: isActive ? category.color : `color-mix(in srgb, ${category.color} 20%, transparent)` }}
    >
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
                onToggleDir={handleToggleDir}
                onOpenFile={handleOpenFile}
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
                  onSelect={() => handleSelectTab(tab.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SidebarFooter(): ReactElement {
  return (
    <div className="border-t border-border/40 px-3 py-2 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-muted-foreground/50 font-mono">⌘K</span>
        <span className="text-[10px] text-muted-foreground/50 font-mono">↑↓</span>
        <span className="text-[10px] text-muted-foreground/50 font-mono">⌘[]</span>
      </div>
      <span className="text-[9px] text-muted-foreground/40">wmux</span>
    </div>
  );
}

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
    <div className="w-[240px] min-w-[240px] bg-[#232325] border-r border-border/50 flex flex-col select-none h-full">
      <div className="flex-1 overflow-y-auto scrollbar-hide py-1.5">
        {categories.map((category) => (
          <CategorySection
            key={category.name}
            category={category}
            isActive={category.name === activeCategory}
            isCollapsed={collapsedCategories.has(category.name)}
            activeTabId={activeTabId}
            onSelectCategory={() => onSelectCategory(category.name)}
            onToggleCollapse={() => onToggleCollapse(category.name)}
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
