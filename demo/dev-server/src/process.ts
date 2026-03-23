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

export interface ManagedProcess {
  readonly id: string;
  readonly name: string;
  readonly config: ProcessConfig;
  readonly status: ProcessStatus;
  readonly attachOutput: (emitter: OutputEmitter) => void;
  readonly start: () => void;
  readonly stop: () => void;
  readonly restart: () => void;
  readonly write: (b64: string) => void;
  readonly resize: (cols: number, rows: number) => void;
  readonly dispose: () => void;
}

export function createManagedProcess(
  id: string,
  name: string,
  config: ProcessConfig,
  onStatusChange: (status: ProcessStatus) => void,
): ManagedProcess {
  let currentStatus: ProcessStatus = "idle";
  let terminal: Terminal | null = null;
  let outputEmitter: OutputEmitter | null = null;
  let cols = 80;
  let rows = 24;
  let restartTimer: ReturnType<typeof setTimeout> | null = null;

  function setStatus(status: ProcessStatus): void {
    currentStatus = status;
    onStatusChange(status);
  }

  function clearRestartTimer(): void {
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
  }

  function stop(): void {
    clearRestartTimer();
    if (terminal) {
      terminal.close();
      terminal = null;
    }
  }

  function start(): void {
    if (currentStatus === "running") return;
    clearRestartTimer();

    const argv = typeof config.command === "string"
      ? ["/bin/sh", "-c", config.command]
      : [...config.command];

    const emitter = outputEmitter;

    const proc = Bun.spawn(argv, {
      cwd: config.cwd,
      env: config.env ? { ...process.env, ...config.env } : undefined,
      terminal: {
        cols,
        rows,
        data: (_t: unknown, data: Uint8Array) => {
          emitter?.emit(toBase64(data));
        },
      },
    });

    terminal = proc.terminal!;
    setStatus("running");

    proc.exited.then((code) => {
      terminal = null;
      const newStatus: ProcessStatus = code === 0 ? "stopped" : "failed";
      setStatus(newStatus);

      if (config.autoRestart && code !== 0) {
        restartTimer = setTimeout(() => {
          restartTimer = null;
          start();
        }, 1000);
      }
    });
  }

  return {
    id,
    name,
    config,
    get status() { return currentStatus; },
    attachOutput(emitter) { outputEmitter = emitter; },
    start,
    stop,
    restart() {
      outputEmitter?.emit(
        toBase64(new TextEncoder().encode("\r\n\x1b[2m--- restarting ---\x1b[0m\r\n")),
      );
      stop();
      start();
    },
    write(b64) { terminal?.write(fromBase64(b64)); },
    resize(newCols, newRows) {
      cols = newCols;
      rows = newRows;
      terminal?.resize(newCols, newRows);
    },
    dispose() {
      clearRestartTimer();
      if (terminal) {
        terminal.close();
        terminal = null;
      }
    },
  };
}
