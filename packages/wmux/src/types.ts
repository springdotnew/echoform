export type ProcessStatus = "idle" | "running" | "stopped" | "failed";

// ── Command mode: wmux spawns the process ──

export interface CommandProcessConfig {
  readonly command: string | readonly string[];
  readonly cwd?: string;
  readonly env?: Record<string, string>;
  readonly autoStart?: boolean;
  readonly autoRestart?: boolean;
}

// ── Terminal mode: user provides an existing terminal handle ──

export interface TerminalBridgeHandle {
  readonly write: (data: string | Uint8Array) => void;
  readonly resize: (cols: number, rows: number) => void;
  readonly onData: (handler: (data: Uint8Array) => void) => void;
  readonly close: () => void;
}

export interface TerminalProcessConfig {
  readonly terminal: TerminalBridgeHandle;
}

// ── Discriminated union ──

export type ProcessConfig = CommandProcessConfig | TerminalProcessConfig;

export const isCommandConfig = (c: ProcessConfig): c is CommandProcessConfig =>
  "command" in c;

export const isTerminalConfig = (c: ProcessConfig): c is TerminalProcessConfig =>
  "terminal" in c;

// ── Tab within a sidebar category ──

export interface TabConfig {
  readonly name: string;
  readonly description?: string;
  readonly icon?: string;
  readonly process: ProcessConfig;
}

// ── Sidebar category ──

export interface SidebarItem {
  readonly category: string;
  readonly icon?: string;
  readonly tabs: readonly TabConfig[];
}

// ── Top-level config ──

export interface WmuxConfig {
  readonly sidebarItems: readonly SidebarItem[];
  readonly files?: string;
  readonly port?: number;
  readonly hostname?: string;
  readonly clientUrl?: string;
  readonly token?: string;
  readonly open?: boolean;
}

// ── Handle returned by wmux() ──

export interface WmuxHandle {
  readonly url: string;
  readonly localUrl: string;
  readonly port: number;
  readonly stop: () => void;
}
