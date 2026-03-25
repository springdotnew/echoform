import type { ReactNode } from "react";
import type { CategoryInfo, TabInfo, FileEntry } from "../types";

const STATUS_DOTS: Record<string, { char: string; color: string }> = {
  running: { char: "\u25cf", color: "#30d158" },
  idle: { char: "\u25cb", color: "#636366" },
  stopped: { char: "\u25cf", color: "#8e8e93" },
  failed: { char: "\u25cf", color: "#ff453a" },
};

const MUTED = "#98989d";
const ACTIVE_BG = "#38383a";
const SIDEBAR_BG = "#232325";

interface SidebarProps {
  readonly categories: ReadonlyArray<CategoryInfo>;
  readonly activeCategory: string;
  readonly activeTabId: string;
  readonly width: number;
}

const renderStatusDot = (status: string): ReactNode => {
  const info = STATUS_DOTS[status] ?? STATUS_DOTS["idle"]!;
  return <span fg={info.color}>{info.char}</span>;
};

const renderTab = (tab: TabInfo, isActive: boolean): ReactNode => (
  <box
    key={tab.id}
    height={1}
    paddingX={1}
    backgroundColor={isActive ? ACTIVE_BG : undefined}
  >
    <text>
      <span fg={MUTED}>{"  "}</span>
      {renderStatusDot(tab.status)}
      <span>{" "}</span>
      <span fg={isActive ? "#f5f5f7" : MUTED}>{tab.name}</span>
    </text>
  </box>
);

const renderFileEntry = (entry: FileEntry): ReactNode => {
  const indent = "  ".repeat(entry.depth + 1);
  const icon = entry.isDir ? (entry.isExpanded ? "\u25be " : "\u25b8 ") : "  ";
  const color = entry.isDir ? MUTED : "#8e8e93";
  return (
    <box key={entry.path} height={1} paddingX={1}>
      <text fg={color}>
        {indent}{icon}{entry.name}
      </text>
    </box>
  );
};

const renderCategory = (
  category: CategoryInfo,
  isActive: boolean,
  activeTabId: string,
): ReactNode => {
  const headerBg = isActive ? "#2c2c2e" : undefined;
  return (
    <box key={category.name} flexDirection="column">
      <box height={1} paddingX={1} backgroundColor={headerBg}>
        <text>
          <span fg={category.color}>{isActive ? "\u25be" : "\u25b8"}</span>
          <span>{" "}</span>
          <span fg={isActive ? "#f5f5f7" : MUTED}>
            {isActive ? <strong>{category.name}</strong> : category.name}
          </span>
        </text>
      </box>
      {isActive && category.type === "process" ? (
        category.tabs.map((tab) => renderTab(tab, tab.id === activeTabId))
      ) : null}
      {isActive && category.type === "files" && category.fileEntries ? (
        category.fileEntries.map((entry) => renderFileEntry(entry))
      ) : null}
      {isActive && category.type === "files" && category.openFiles && category.openFiles.length > 0 ? (
        <box flexDirection="column">
          <box height={1} paddingX={1}>
            <text fg="#636366">  open files:</text>
          </box>
          {category.openFiles.map((file) => (
            <box key={file.path} height={1} paddingX={1} backgroundColor={`file::${file.path}` === activeTabId ? ACTIVE_BG : undefined}>
              <text fg={`file::${file.path}` === activeTabId ? "#f5f5f7" : MUTED}>
                {"    "}{file.name}
              </text>
            </box>
          ))}
        </box>
      ) : null}
    </box>
  );
};

export const Sidebar = ({
  categories,
  activeCategory,
  activeTabId,
  width,
}: SidebarProps): ReactNode => (
  <box
    width={width}
    flexDirection="column"
    backgroundColor={SIDEBAR_BG}
    border={["right"]}
    borderStyle="single"
    borderColor="#38383a"
  >
    <scrollbox flexGrow={1}>
      {categories.map((category) =>
        renderCategory(category, category.name === activeCategory, activeTabId),
      )}
    </scrollbox>
  </box>
);
