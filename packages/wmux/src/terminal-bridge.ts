import type { TerminalBridgeHandle } from "./types";

interface TerminalLike {
  write(d: string | Uint8Array): void;
  resize(cols: number, rows: number): void;
  close(): void;
}

export interface TerminalBridge {
  /** Pass this to Bun.spawn's `terminal` option */
  readonly pty: {
    readonly cols: number;
    readonly rows: number;
    readonly data: (terminal: unknown, chunk: Uint8Array) => void;
  };
  /** Pass this to wmux's `terminal` process config */
  readonly handle: TerminalBridgeHandle;
}

export interface TerminalBridgeOptions {
  readonly cols?: number;
  readonly rows?: number;
  readonly onRestart?: () => void;
}

/**
 * Creates a bridge between a Bun.spawn terminal and wmux.
 *
 * Usage:
 * ```ts
 * const bridge = createTerminalBridge({ cols: 80, rows: 24 });
 * const proc = Bun.spawn(["bun", "run", "dev"], { terminal: bridge.pty });
 * await wmux({ processes: { app: { terminal: bridge.handle } } });
 * ```
 */
export function createTerminalBridge(
  opts?: TerminalBridgeOptions,
): TerminalBridge {
  let dataHandler: ((data: Uint8Array) => void) | null = null;
  let terminal: TerminalLike | null = null;

  const pty = {
    cols: opts?.cols ?? 80,
    rows: opts?.rows ?? 24,
    data(t: unknown, chunk: Uint8Array) {
      // Capture the current Bun terminal reference, including after external restarts.
      if (t && typeof t === "object" && "write" in t && "resize" in t && "close" in t) {
        terminal = t as TerminalLike;
      }
      dataHandler?.(chunk);
    },
  };

  const handle: TerminalBridgeHandle = {
    write(data: string | Uint8Array) {
      terminal?.write(data);
    },
    resize(cols: number, rows: number) {
      terminal?.resize(cols, rows);
    },
    onData(handler: (data: Uint8Array) => void) {
      dataHandler = handler;
    },
    ...(opts?.onRestart ? { onRestart: opts.onRestart } : {}),
    close() {
      terminal?.close();
      terminal = null;
    },
  };

  return { pty, handle };
}
