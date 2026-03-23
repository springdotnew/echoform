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
  opts?: { readonly cols?: number; readonly rows?: number },
): TerminalBridge {
  let dataHandler: ((data: Uint8Array) => void) | null = null;
  let terminal: TerminalLike | null = null;

  const pty = {
    cols: opts?.cols ?? 80,
    rows: opts?.rows ?? 24,
    data(t: unknown, chunk: Uint8Array) {
      // Capture the Bun terminal reference on first data callback
      if (!terminal && t && typeof t === "object" && "write" in t && "resize" in t && "close" in t) {
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
    close() {
      terminal?.close();
    },
  };

  return { pty, handle };
}
