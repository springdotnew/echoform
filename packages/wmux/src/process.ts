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

interface CommandProcessState {
  currentStatus: ProcessStatus;
  terminal: Terminal | null;
  outputEmitter: OutputEmitter | null;
  cols: number;
  rows: number;
  restartTimer: ReturnType<typeof setTimeout> | null;
}

function createInitialCommandState(): CommandProcessState {
  return { currentStatus: "idle", terminal: null, outputEmitter: null, cols: 80, rows: 24, restartTimer: null };
}

function clearRestartTimer(state: CommandProcessState): void {
  if (!state.restartTimer) return;
  clearTimeout(state.restartTimer);
  state.restartTimer = null;
}

function closeTerminal(state: CommandProcessState): void {
  if (!state.terminal) return;
  state.terminal.close();
  state.terminal = null;
}

function buildArgv(command: string | readonly string[]): string[] {
  return typeof command === "string" ? ["/bin/sh", "-c", command] : [...command];
}

function createCommandProcess(
  id: string,
  name: string,
  config: CommandProcessConfig,
  onStatusChange: (status: ProcessStatus) => void,
): ManagedProcess {
  const state = createInitialCommandState();

  const setStatus = (status: ProcessStatus): void => {
    state.currentStatus = status;
    onStatusChange(status);
  };

  const stop = (): void => {
    clearRestartTimer(state);
    closeTerminal(state);
  };

  const start = (): void => {
    if (state.currentStatus === "running") return;
    clearRestartTimer(state);

    const argv = buildArgv(config.command);
    const emitter = state.outputEmitter;

    const proc = Bun.spawn(argv, {
      ...(config.cwd != null && { cwd: config.cwd }),
      ...(config.env != null && { env: { ...process.env, ...config.env } }),
      terminal: {
        cols: state.cols,
        rows: state.rows,
        data: (_t: unknown, data: Uint8Array) => {
          emitter?.emit(toBase64(data));
        },
      },
    });

    state.terminal = proc.terminal!;
    setStatus("running");

    proc.exited.then((code) => {
      state.terminal = null;
      const exitStatus: ProcessStatus = code === 0 ? "stopped" : "failed";
      setStatus(exitStatus);

      if (!config.autoRestart || code === 0) return;
      state.restartTimer = setTimeout(() => {
        state.restartTimer = null;
        start();
      }, 1000);
    });
  };

  return {
    id,
    name,
    config,
    get status() { return state.currentStatus; },
    attachOutput(emitter) { state.outputEmitter = emitter; },
    start,
    stop,
    restart() {
      state.outputEmitter?.emit(
        toBase64(new TextEncoder().encode("\r\n\x1b[2m--- restarting ---\x1b[0m\r\n")),
      );
      stop();
      start();
    },
    write(b64) { state.terminal?.write(fromBase64(b64)); },
    resize(newCols, newRows) {
      state.cols = newCols;
      state.rows = newRows;
      state.terminal?.resize(newCols, newRows);
    },
    dispose() {
      clearRestartTimer(state);
      closeTerminal(state);
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
    start() {},
    stop() { handle.close(); setStatus("stopped"); },
    restart() {},
    write(b64) { handle.write(fromBase64(b64)); },
    resize(cols, rows) { handle.resize(cols, rows); },
    dispose() { handle.close(); setStatus("stopped"); },
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
