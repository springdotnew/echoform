import { createTerminalBridge, type TerminalBridgeHandle } from "@playfast/wmux";

interface RestartableTerminal {
  readonly handle: TerminalBridgeHandle;
}

interface RunningProcess {
  readonly exited: Promise<number>;
  kill(): void;
}

export function createExposedApiTerminal(): RestartableTerminal {
  let proc: RunningProcess | null = null;
  let restartCount = 0;

  const spawn = (): void => {
    const session = ++restartCount;
    const current = Bun.spawn([
      "bash",
      "-lc",
      `printf '\\033[2mexposed api session ${session}\\033[0m\\r\\n'; i=0; while true; do printf 'bridge tick ${session}.%s\\r\\n' "$i"; i=$((i+1)); sleep 1; done`,
    ], { terminal: bridge.pty });

    proc = current;
    current.exited.then(() => {
      if (proc === current) proc = null;
    });
  };

  const restart = (): void => {
    proc?.kill();
    spawn();
  };

  const bridge = createTerminalBridge({ onRestart: restart });
  spawn();

  return { handle: bridge.handle };
}
