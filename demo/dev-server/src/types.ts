export interface ProcessConfig {
  readonly command: string | readonly string[];
  readonly cwd?: string;
  readonly env?: Record<string, string>;
  readonly autoStart?: boolean;
  readonly autoRestart?: boolean;
}

export interface DevServerConfig {
  readonly procs: Record<string, ProcessConfig>;
  readonly port?: number;
}

export type ProcessStatus = "idle" | "running" | "stopped" | "failed";
