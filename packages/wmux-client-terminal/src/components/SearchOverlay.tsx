/** @jsxImportSource @opentui/react */
import { useState, useCallback, useMemo, type ReactNode } from "react";
import { useKeyboard } from "@opentui/react";
import type { CategoryInfo } from "../types";

const BG = "#1c1c1e";
const BORDER_COLOR = "#38383a";
const MUTED = "#636366";
const ACCENT = "#0a84ff";
const ACTIVE_BG = "#38383a";
const TEXT_COLOR = "#f5f5f7";
const DIM = "#98989d";

interface SearchItem {
  readonly type: "process" | "file";
  readonly label: string;
  readonly sublabel: string;
  readonly categoryName: string;
  readonly tabId?: string;
  readonly filePath?: string;
  readonly status?: string;
  readonly color: string;
}

interface SearchOverlayProps {
  readonly categories: ReadonlyArray<CategoryInfo>;
  readonly onSelectCategory: (name: string) => void;
  readonly onSelectTab: (id: string) => void;
  readonly onOpenFile: (path: string) => void;
  readonly onClose: () => void;
}

const STATUS_CHARS: Record<string, { readonly char: string; readonly color: string }> = {
  running: { char: "\u25cf", color: "#30d158" },
  idle: { char: "\u25cb", color: "#636366" },
  stopped: { char: "\u25cf", color: "#8e8e93" },
  failed: { char: "\u25cf", color: "#ff453a" },
};

const buildSearchItems = (categories: ReadonlyArray<CategoryInfo>): readonly SearchItem[] =>
  categories.flatMap((cat): readonly SearchItem[] => [
    ...( cat.type === "process"
      ? cat.tabs.map((tab): SearchItem => ({
          type: "process",
          label: tab.name,
          sublabel: cat.name,
          categoryName: cat.name,
          tabId: tab.id,
          status: tab.status,
          color: cat.color,
        }))
      : []),
    ...( cat.type === "files" && cat.fileEntries
      ? cat.fileEntries
          .filter((e) => !e.isDir)
          .map((entry): SearchItem => ({
            type: "file",
            label: entry.name,
            sublabel: entry.path,
            categoryName: cat.name,
            filePath: entry.path,
            color: cat.color,
          }))
      : []),
  ]);

const matchesQuery = (item: SearchItem, lower: string): boolean =>
  item.label.toLowerCase().includes(lower) || item.sublabel.toLowerCase().includes(lower);

const filterItems = (items: readonly SearchItem[], query: string): readonly SearchItem[] =>
  query === "" ? items : items.filter((item) => matchesQuery(item, query.toLowerCase()));

const isPrintableChar = (key: { readonly sequence?: string; readonly ctrl: boolean; readonly meta: boolean }): boolean =>
  Boolean(key.sequence) && key.sequence!.length === 1 && !key.ctrl && !key.meta && key.sequence!.charCodeAt(0) >= 0x20;

const renderItemIcon = (item: SearchItem): ReactNode => {
  if (item.type !== "process") return <span fg={DIM}>{"  "}</span>;
  const info = STATUS_CHARS[item.status ?? "idle"] ?? STATUS_CHARS["idle"]!;
  return <span fg={info.color}>{info.char} </span>;
};

const renderItem = (item: SearchItem, isSelected: boolean, onSelect?: () => void): ReactNode => (
  <box
    key={`${item.type}-${item.tabId ?? item.filePath ?? item.categoryName}`}
    height={1}
    paddingX={2}
    backgroundColor={isSelected ? ACTIVE_BG : undefined}
    onMouseDown={onSelect}
  >
    <text>
      <span fg={isSelected ? ACCENT : DIM}>{isSelected ? "\u25b8 " : "  "}</span>
      {renderItemIcon(item)}
      <span fg={isSelected ? TEXT_COLOR : DIM}>{item.label}</span>
      <span fg={MUTED}>{"  "}{item.sublabel}</span>
    </text>
  </box>
);

export const SearchOverlay = ({
  categories,
  onSelectCategory,
  onSelectTab,
  onOpenFile,
  onClose,
}: SearchOverlayProps): ReactNode => {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const allItems = useMemo(() => buildSearchItems(categories), [categories]);
  const filtered = useMemo(() => filterItems(allItems, query), [allItems, query]);

  const selectItem = useCallback((item: SearchItem) => {
    onSelectCategory(item.categoryName);
    if (item.tabId) onSelectTab(item.tabId);
    if (item.filePath) {
      onSelectTab(`file::${item.filePath}`);
      onOpenFile(item.filePath);
    }
    onClose();
  }, [onSelectCategory, onSelectTab, onOpenFile, onClose]);

  useKeyboard((key) => {
    if (key.name === "escape") { onClose(); return; }

    if (key.name === "up" || (key.ctrl && key.name === "p")) {
      setSelectedIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (key.name === "down" || (key.ctrl && key.name === "n")) {
      setSelectedIndex((i) => Math.min(filtered.length - 1, i + 1));
      return;
    }

    if (key.name === "enter" || key.name === "return") {
      const item = filtered[selectedIndex];
      if (item) selectItem(item);
      return;
    }

    if (key.name === "backspace") {
      setQuery((q) => q.slice(0, -1));
      setSelectedIndex(0);
      return;
    }

    if (isPrintableChar(key)) {
      setQuery((q) => q + key.sequence!);
      setSelectedIndex(0);
    }
  });

  return (
    <box flexGrow={1} flexDirection="column" backgroundColor={BG}>
      <box height={1} paddingX={1} backgroundColor="#2c2c2e">
        <text>
          <span fg={ACCENT}>{"\u276f "}</span>
          <span fg={TEXT_COLOR}>{query}</span>
          <span fg={ACCENT}>{"\u258f"}</span>
        </text>
      </box>
      <box height={1} backgroundColor={BORDER_COLOR} />
      <scrollbox flexGrow={1}>
        {filtered.length === 0 ? (
          <box height={1} paddingX={2}>
            <text fg={MUTED}>No results</text>
          </box>
        ) : (
          filtered.map((item, i) => renderItem(item, i === selectedIndex, () => selectItem(item)))
        )}
      </scrollbox>
      <box height={1} paddingX={1} backgroundColor="#2c2c2e">
        <text fg={MUTED}>
          <span fg={ACCENT}>{"\u2191\u2193"}</span>{" nav  "}
          <span fg={ACCENT}>enter</span>{" select  "}
          <span fg={ACCENT}>esc</span>{" close"}
        </text>
      </box>
    </box>
  );
};
