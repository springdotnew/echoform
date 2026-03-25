import { wmux } from "../wmux";
import type { WmuxConfig } from "../types";
import type { WmuxTUIHandle } from "@playfast/wmux-client-terminal";

export interface WmuxTUIPresetConfig extends Omit<WmuxConfig, "open"> {}

export interface WmuxTUIPresetHandle {
  /** Full web client URL (with token and ws params) */
  readonly url: string;
  /** Stop the wmux server and all processes */
  readonly stop: () => void;
  /** Resolves when the TUI is closed (user quit or programmatic stop) */
  readonly done: Promise<void>;
}

export async function wmuxTUI(config: WmuxTUIPresetConfig): Promise<WmuxTUIPresetHandle> {
  const handle = await wmux({ ...config, open: false });

  // Print web URL before TUI takes over the screen
  console.log(`\x1b[1m\x1b[34mweb\x1b[0m  → \x1b[4m${handle.url}\x1b[0m`);

  const { renderWmuxTUI } = await import("@playfast/wmux-client-terminal");

  const tui: WmuxTUIHandle = await renderWmuxTUI({
    token: handle.token,
    wsUrl: handle.wsUrl,
    webUrl: handle.url,
  });

  const done = tui.done.then(() => {
    handle.stop();
  });

  const stop = (): void => {
    tui.destroy();
  };

  return { url: handle.url, stop, done };
}
