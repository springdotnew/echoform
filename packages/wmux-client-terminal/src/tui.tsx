import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { Client } from "@playfast/echoform/client";
import type { Transport } from "@playfast/echoform/shared";
import { connectTransport } from "./transport";
import { TUIProvider } from "./components/FocusContext";
import { WmuxApp } from "./components/WmuxApp";
import { WmuxTerminal } from "./components/WmuxTerminal";
import { WmuxFileContent } from "./components/WmuxFileContent";
import { WmuxIframe } from "./components/WmuxIframe";

const tuiViewComponents = {
  WmuxApp,
  WmuxTerminal,
  WmuxFileContent,
  WmuxIframe,
};

export interface WmuxTUIOptions {
  readonly token: string;
  readonly wsUrl: string;
  readonly webUrl?: string;
}

export interface WmuxTUIHandle {
  /** Programmatically destroy the TUI */
  readonly destroy: () => void;
  /** Resolves when the TUI is closed (user quit or destroy() called) */
  readonly done: Promise<void>;
}

const TUIRoot = ({ transport, webUrl }: { readonly transport: Transport<Record<string, unknown>>; readonly webUrl?: string }) => (
  <TUIProvider webUrl={webUrl}>
    <Client transport={transport} views={tuiViewComponents} requestViewTreeOnMount />
  </TUIProvider>
);

export const renderWmuxTUI = async (options: WmuxTUIOptions): Promise<WmuxTUIHandle> => {
  let connection: ReturnType<typeof connectTransport> | null = null;
  let resolveDone: (() => void) | null = null;
  const done = new Promise<void>((resolve) => { resolveDone = resolve; });

  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
    onDestroy: () => {
      connection?.destroy();
      resolveDone?.();
    },
  });

  // Ensure cleanup on crashes
  const onError = (error: unknown): void => {
    console.error(error);
    renderer.destroy();
    process.exit(1);
  };
  process.on("uncaughtException", onError);
  process.on("unhandledRejection", onError);

  connection = connectTransport(options.wsUrl, options.token);
  await connection.waitForConnection();

  const root = createRoot(renderer);
  root.render(<TUIRoot transport={connection.transport} webUrl={options.webUrl} />);

  const destroy = (): void => {
    renderer.destroy();
  };

  return { destroy, done };
};
