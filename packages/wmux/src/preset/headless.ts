import type { SidebarItem, CommandTabConfig, TerminalBridgeHandle } from "../types";
import { isCommandTab, isTerminalTab } from "../types";

const LABEL_COLORS = ["\x1b[36m", "\x1b[33m", "\x1b[35m", "\x1b[32m", "\x1b[34m", "\x1b[31m"];
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

export interface WmuxHeadlessConfig {
  readonly sidebarItems: readonly SidebarItem[];
}

export interface WmuxHeadlessHandle {
  readonly stop: () => void;
  readonly done: Promise<void>;
}

function createLinePrefixer(prefix: string): (data: Uint8Array) => void {
  let lineStart = true;
  return (data) => {
    const text = new TextDecoder().decode(data);
    let out = "";
    for (let i = 0; i < text.length; i++) {
      if (lineStart) { out += prefix; lineStart = false; }
      out += text[i];
      if (text[i] === "\n") lineStart = true;
    }
    process.stdout.write(out);
  };
}

function buildArgv(command: string | readonly string[]): string[] {
  return typeof command === "string" ? ["/bin/sh", "-c", command] : [...command];
}

export async function wmuxHeadless(config: WmuxHeadlessConfig): Promise<WmuxHeadlessHandle> {
  const commands: { name: string; tab: CommandTabConfig }[] = [];
  const terminals: { name: string; handle: TerminalBridgeHandle }[] = [];

  for (const item of config.sidebarItems) {
    for (const tab of item.tabs ?? []) {
      if (isCommandTab(tab)) commands.push({ name: tab.name, tab });
      else if (isTerminalTab(tab)) terminals.push({ name: tab.name, handle: tab.terminal });
    }
  }

  const allNames = [...commands.map((c) => c.name), ...terminals.map((t) => t.name)];
  const maxLen = Math.max(...allNames.map((n) => n.length), 0);
  const slots: { current: { kill(): void } | null }[] = [];
  const exitPromises: Promise<void>[] = [];
  let colorIdx = 0;
  let stopped = false;

  for (const { name, tab } of commands) {
    const color = LABEL_COLORS[colorIdx++ % LABEL_COLORS.length]!;
    const prefix = `${color}${BOLD}[${name.padEnd(maxLen)}]${RESET} `;
    const write = createLinePrefixer(prefix);
    const slot: { current: { kill(): void } | null } = { current: null };
    slots.push(slot);

    const spawn = (): Promise<void> => {
      const argv = buildArgv(tab.command);
      const proc = Bun.spawn(argv, {
        ...(tab.cwd != null && { cwd: tab.cwd }),
        ...(tab.env != null && { env: { ...process.env, ...tab.env } }),
        terminal: {
          cols: process.stdout.columns ?? 80,
          rows: process.stdout.rows ?? 24,
          data: (_t: unknown, chunk: Uint8Array) => write(chunk),
        },
      });
      slot.current = proc;

      return proc.exited.then((code) => {
        slot.current = null;
        const status = code === 0
          ? `${DIM}exited${RESET}`
          : `\x1b[31mexited with code ${code}${RESET}`;
        process.stdout.write(`${prefix}${status}\n`);

        if (!stopped && tab.autoRestart && code !== 0) {
          return new Promise<void>((resolve) =>
            setTimeout(() => spawn().then(resolve), 1000),
          );
        }
      });
    };

    if (tab.autoStart !== false) {
      exitPromises.push(spawn());
    }
  }

  for (const { name, handle } of terminals) {
    const color = LABEL_COLORS[colorIdx++ % LABEL_COLORS.length]!;
    const prefix = `${color}${BOLD}[${name.padEnd(maxLen)}]${RESET} `;
    const write = createLinePrefixer(prefix);
    handle.onData((data) => write(data));
    slots.push({ current: { kill: () => handle.close() } });
  }

  const done = Promise.all(exitPromises).then(() => {});

  const stop = (): void => {
    stopped = true;
    for (const slot of slots) slot.current?.kill();
  };

  process.on("SIGINT", () => { stop(); process.exit(0); });
  process.on("SIGTERM", () => { stop(); process.exit(0); });

  return { stop, done };
}
