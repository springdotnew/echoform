export type ProcessStatus = "idle" | "running" | "stopped" | "failed";

export interface CommandProcessConfig {
  readonly command: string | readonly string[];
  readonly cwd?: string;
  readonly env?: Record<string, string>;
  readonly autoStart?: boolean;
  readonly autoRestart?: boolean;
}

export interface TerminalBridgeHandle {
  readonly write: (data: string | Uint8Array) => void;
  readonly resize: (cols: number, rows: number) => void;
  readonly onData: (handler: (data: Uint8Array) => void) => void;
  readonly close: () => void;
}

export interface TerminalProcessConfig {
  readonly terminal: TerminalBridgeHandle;
}

export type ProcessConfig = CommandProcessConfig | TerminalProcessConfig;

export const isCommandConfig = (c: ProcessConfig): c is CommandProcessConfig =>
  "command" in c;

export const isTerminalConfig = (c: ProcessConfig): c is TerminalProcessConfig =>
  "terminal" in c;

export interface TabConfig {
  readonly name: string;
  readonly description?: string;
  readonly icon?: string;
  readonly process?: ProcessConfig;
  readonly url?: string;
}

export interface SidebarItem {
  readonly category: string;
  readonly icon?: string;
  readonly tabs?: readonly TabConfig[];
  readonly files?: string;
}

export interface WmuxConfig {
  readonly title?: string;
  readonly description?: string;
  readonly sidebarItems: readonly SidebarItem[];
  readonly port?: number;
  readonly hostname?: string;
  readonly clientUrl?: string;
  readonly token?: string;
  readonly open?: boolean;
}

export interface WmuxHandle {
  readonly url: string;
  readonly localUrl: string;
  readonly port: number;
  readonly stop: () => void;
}
