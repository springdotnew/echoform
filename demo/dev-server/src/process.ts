import type { ProcessConfig, ProcessStatus } from "./types";

function toBase64(data: Uint8Array): string {
  return Buffer.from(data).toString("base64");
}

function fromBase64(data: string): Uint8Array {
  return Buffer.from(data, "base64");
}

interface OutputEmitter {
  readonly emit: (chunk: string) => void;
}

interface Terminal {
  write(d: string | Uint8Array): void;
  resize(cols: number, rows: number): void;
  close(): void;
}

export class ManagedProcess {
  readonly id: string;
  readonly name: string;
  readonly config: ProcessConfig;

  status: ProcessStatus = "idle";

  private terminal: Terminal | null = null;
  private outputEmitter: OutputEmitter | null = null;
  private cols = 80;
  private rows = 24;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly onStatusChange: (status: ProcessStatus) => void;

  constructor(
    id: string,
    name: string,
    config: ProcessConfig,
    onStatusChange: (status: ProcessStatus) => void,
  ) {
    this.id = id;
    this.name = name;
    this.config = config;
    this.onStatusChange = onStatusChange;
  }

  attachOutput(emitter: OutputEmitter): void {
    this.outputEmitter = emitter;
  }

  start(): void {
    if (this.status === "running") return;
    this.clearRestartTimer();

    const argv = typeof this.config.command === "string"
      ? ["/bin/sh", "-c", this.config.command]
      : [...this.config.command];

    const emitter = this.outputEmitter;

    const proc = Bun.spawn(argv, {
      cwd: this.config.cwd,
      env: this.config.env ? { ...process.env, ...this.config.env } : undefined,
      terminal: {
        cols: this.cols,
        rows: this.rows,
        data: (_t: unknown, data: Uint8Array) => {
          emitter?.emit(toBase64(data));
        },
      },
    });

    this.terminal = proc.terminal!;
    this.setStatus("running");

    proc.exited.then((code) => {
      this.terminal = null;
      const newStatus: ProcessStatus = code === 0 ? "stopped" : "failed";
      this.setStatus(newStatus);

      if (this.config.autoRestart && code !== 0) {
        this.restartTimer = setTimeout(() => {
          this.restartTimer = null;
          this.start();
        }, 1000);
      }
    });
  }

  stop(): void {
    this.clearRestartTimer();
    if (this.terminal) {
      this.terminal.close();
      this.terminal = null;
    }
  }

  restart(): void {
    this.outputEmitter?.emit(
      toBase64(new TextEncoder().encode("\r\n\x1b[2m--- restarting ---\x1b[0m\r\n")),
    );
    this.stop();
    this.start();
  }

  write(b64: string): void {
    this.terminal?.write(fromBase64(b64));
  }

  resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
    this.terminal?.resize(cols, rows);
  }

  dispose(): void {
    this.clearRestartTimer();
    if (this.terminal) {
      this.terminal.close();
      this.terminal = null;
    }
  }

  private setStatus(status: ProcessStatus): void {
    this.status = status;
    this.onStatusChange(status);
  }

  private clearRestartTimer(): void {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
  }
}
