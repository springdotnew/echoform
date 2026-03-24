import type { ProcessConfig, CommandProcessConfig, ProcessStatus, TerminalBridgeHandle } from "./types";
import { isCommandConfig, isTerminalConfig } from "./types";

function toBase64(data: Uint8Array): string {
  return Buffer.from(data).toString("base64");
}

function fromBase64(data: string): Uint8Array {
  return new Uint8Array(Buffer.from(data, "base64"));
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

function createCommandProcess(
  id: string,
  name: string,
  config: CommandProcessConfig,
  onStatusChange: (status: ProcessStatus) => void,
): ManagedProcess {
  let currentStatus: ProcessStatus = "idle";
  let terminal: Terminal | null = null;
  let outputEmitter: OutputEmitter | null = null;
  let cols = 80;
  let rows = 24;
  let restartTimer: ReturnType<typeof setTimeout> | null = null;

  const setStatus = (status: ProcessStatus): void => {
    currentStatus = status;
    onStatusChange(status);
  };

  const clearRestartTimer = (): void => {
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
  };

  const stop = (): void => {
    clearRestartTimer();
    if (terminal) {
      terminal.close();
      terminal = null;
    }
  };

  const start = (): void => {
    if (currentStatus === "running") return;
    clearRestartTimer();

    const argv = typeof config.command === "string"
      ? ["/bin/sh", "-c", config.command]
      : [...config.command];

    const emitter = outputEmitter;

    const proc = Bun.spawn(argv, {
      ...(config.cwd != null && { cwd: config.cwd }),
      ...(config.env != null && { env: { ...process.env, ...config.env } }),
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
  };

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

function createTerminalProcess(
  id: string,
  name: string,
  handle: TerminalBridgeHandle,
  onStatusChange: (status: ProcessStatus) => void,
): ManagedProcess {
  let currentStatus: ProcessStatus = "running";
  let outputEmitter: OutputEmitter | null = null;

  const setStatus = (status: ProcessStatus): void => {
    currentStatus = status;
    onStatusChange(status);
  };

  // Wire output: terminal data → base64 → emitter
  handle.onData((data: Uint8Array) => {
    outputEmitter?.emit(toBase64(data));
  });

  setStatus("running");

  return {
    id,
    name,
    config: { terminal: handle },
    get status() { return currentStatus; },
    attachOutput(emitter) { outputEmitter = emitter; },
    start() { /* terminal mode is always running */ },
    stop() {
      handle.close();
      setStatus("stopped");
    },
    restart() {
      /* terminal mode does not support restart */
    },
    write(b64) { handle.write(fromBase64(b64)); },
    resize(cols, rows) { handle.resize(cols, rows); },
    dispose() {
      handle.close();
      setStatus("stopped");
    },
  };
}

export function createManagedProcess(
  id: string,
  name: string,
  config: ProcessConfig,
  onStatusChange: (status: ProcessStatus) => void,
): ManagedProcess {
  if (isTerminalConfig(config)) {
    return createTerminalProcess(id, name, config.terminal, onStatusChange);
  }
  if (isCommandConfig(config)) {
    return createCommandProcess(id, name, config, onStatusChange);
  }
  throw new Error("Invalid process config: must have either 'command' or 'terminal'");
}
