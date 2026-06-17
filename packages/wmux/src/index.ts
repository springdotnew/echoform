export { wmux } from "./wmux";
export { createTerminalBridge } from "./terminal-bridge";
export type { TerminalBridge, TerminalBridgeOptions } from "./terminal-bridge";
export type {
  WmuxConfig,
  WmuxHandle,
  ProcessConfig,
  CommandProcessConfig,
  TerminalProcessConfig,
  TerminalBridgeHandle,
  TabConfig,
  CommandTabConfig,
  TerminalTabConfig,
  UrlTabConfig,
  MarkdownTabConfig,
  SidebarItem,
  ProcessStatus,
} from "./types";
export { isCommandTab, isTerminalTab, isUrlTab, isMarkdownTab } from "./types";
