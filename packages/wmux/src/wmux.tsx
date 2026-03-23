import React from "react";
import { Render } from "@playfast/echoform-render";
import { Server } from "@playfast/echoform/server";
import { createManagedProcess, type ManagedProcess } from "./process";
import { createWmuxServer } from "./server";
import { generateToken } from "./token";
import { WmuxRoot } from "./components/WmuxRoot";
import type { WmuxConfig, WmuxHandle } from "./types";

const BUILT_IN_CLIENT_URL = "__WMUX_CLIENT_URL__";

function openBrowser(url: string): void {
  try {
    const platform = process.platform;
    if (platform === "darwin") {
      Bun.spawn(["open", url]);
    } else if (platform === "linux") {
      Bun.spawn(["xdg-open", url]);
    } else if (platform === "win32") {
      Bun.spawn(["cmd", "/c", "start", url]);
    }
  } catch {
    // silently ignore — browser open is best-effort
  }
}

export async function wmux(config: WmuxConfig): Promise<WmuxHandle> {
  const port = config.port ?? 0;
  const hostname = config.hostname ?? "127.0.0.1";
  const token = config.token ?? generateToken();
  const clientUrl = config.clientUrl
    ?? process.env.WMUX_CLIENT_URL
    ?? (BUILT_IN_CLIENT_URL.startsWith("__") ? "http://localhost:5173" : BUILT_IN_CLIENT_URL);

  // Create managed processes from sidebarItems
  const processes = new Map<string, ManagedProcess>();
  const categoryDefs: Array<{ name: string; tabIds: string[] }> = [];

  for (const item of config.sidebarItems) {
    const tabIds: string[] = [];
    for (const tab of item.tabs) {
      const id = `${item.category}/${tab.name}`;
      processes.set(id, createManagedProcess(id, tab.name, tab.process, () => {}));
      tabIds.push(id);
    }
    categoryDefs.push({ name: item.category, tabIds });
  }

  // Start server
  const { transport, server, stop: stopServer } = createWmuxServer({
    port,
    hostname,
    token,
    clientUrl,
  });

  const actualPort = server.port ?? port;
  const wsUrl = `ws://${hostname === "0.0.0.0" || hostname === "127.0.0.1" ? "localhost" : hostname}:${actualPort}/ws`;
  const fullClientUrl = `${clientUrl}/#token=${encodeURIComponent(token)}&ws=${encodeURIComponent(wsUrl)}`;

  console.log(`\x1b[1m\x1b[32mwmux\x1b[0m → \x1b[4m${fullClientUrl}\x1b[0m`);
  console.log(`\x1b[2m       ws://${hostname}:${actualPort}/ws\x1b[0m`);

  if (config.open !== false) {
    openBrowser(`http://${hostname === "0.0.0.0" || hostname === "127.0.0.1" ? "localhost" : hostname}:${actualPort}/`);
  }

  Render(
    <Server transport={transport}>
      {() => <WmuxRoot processes={processes} categoryDefs={categoryDefs} />}
    </Server>,
  );

  const stop = (): void => {
    for (const proc of processes.values()) proc.dispose();
    stopServer();
  };

  process.on("SIGINT", () => { stop(); process.exit(0); });
  process.on("SIGTERM", () => { stop(); process.exit(0); });

  return {
    url: fullClientUrl,
    localUrl: wsUrl,
    port: actualPort,
    stop,
  };
}
