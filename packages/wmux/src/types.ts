export type ProcessStatus = "idle" | "running" | "stopped" | "failed";

// ── Process entry (config + metadata) ──

export interface ProcessEntry {
  readonly config: ProcessConfig;
  readonly category?: string;
}

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

// ── Layout ──

export type LayoutPreset = "tabs" | "split-horizontal" | "split-vertical" | "grid";

export interface PanelPosition {
  readonly referencePanel?: string;
  readonly direction?: "left" | "right" | "above" | "below" | "within";
}

export interface LayoutConfig {
  readonly preset?: LayoutPreset;
  readonly panels?: Record<string, PanelPosition>;
}

// ── Top-level config ──

export interface WmuxConfig {
  readonly processes: Record<string, ProcessConfig | ProcessEntry>;
  readonly port?: number;
  readonly hostname?: string;
  readonly layout?: LayoutConfig;
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

// ── Helpers ──

export const isProcessEntry = (v: ProcessConfig | ProcessEntry): v is ProcessEntry =>
  "config" in v;

export const toProcessEntry = (v: ProcessConfig | ProcessEntry): ProcessEntry =>
  isProcessEntry(v) ? v : { config: v };
