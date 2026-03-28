import { Render } from "@playfast/echoform-render";
import { Server } from "@playfast/echoform/server";
import { createManagedProcess, type ManagedProcess } from "./process";
import { createWmuxServer } from "./server";
import { generateToken } from "./token";
import { WmuxRoot } from "./components/WmuxRoot";
import type { WmuxConfig, WmuxHandle, SidebarItem, CommandProcessConfig, TerminalProcessConfig } from "./types";
import { isCommandTab, isTerminalTab, isUrlTab, isMarkdownTab } from "./types";

const BUILT_IN_CLIENT_URL = "https://wmux.play.fast";

const PLATFORM_OPEN_COMMANDS: Record<string, readonly string[]> = {
  darwin: ["open"],
  linux: ["xdg-open"],
  win32: ["cmd", "/c", "start"],
};

function openBrowser(url: string): void {
  try {
    const argv = PLATFORM_OPEN_COMMANDS[process.platform];
    if (argv) Bun.spawn([...argv, url]);
  } catch {
    // browser open is best-effort
  }
}

interface TabDef {
  readonly id: string;
  readonly description?: string | undefined;
  readonly icon?: string | undefined;
  readonly tabType: "process" | "iframe" | "markdown";
  readonly url?: string | undefined;
  readonly markdown?: string | undefined;
}

interface CategoryDef {
  readonly name: string;
  readonly icon?: string | undefined;
  readonly type: "process" | "files";
  readonly tabs: readonly TabDef[];
  readonly fileRoot?: string | undefined;
}

function buildFileCategoryDef(item: SidebarItem): CategoryDef {
  return { name: item.category, icon: item.icon, type: "files", tabs: [], fileRoot: item.files };
}

function buildProcessTabs(
  item: SidebarItem,
  processes: Map<string, ManagedProcess>,
): readonly TabDef[] {
  const result: TabDef[] = [];
  for (const tab of item.tabs ?? []) {
    const id = `${item.category}/${tab.name}`;
    if (isUrlTab(tab)) {
      result.push({ id, description: tab.description, icon: tab.icon, tabType: "iframe", url: tab.url });
    } else if (isMarkdownTab(tab)) {
      result.push({ id, description: tab.description, icon: tab.icon, tabType: "markdown", markdown: tab.markdown });
    } else if (isCommandTab(tab)) {
      const processConfig: CommandProcessConfig = {
        command: tab.command,
        cwd: tab.cwd,
        env: tab.env,
        autoStart: tab.autoStart,
        autoRestart: tab.autoRestart,
      };
      processes.set(id, createManagedProcess(id, tab.name, processConfig, () => {}));
      result.push({ id, description: tab.description, icon: tab.icon, tabType: "process" });
    } else if (isTerminalTab(tab)) {
      const processConfig: TerminalProcessConfig = { terminal: tab.terminal };
      processes.set(id, createManagedProcess(id, tab.name, processConfig, () => {}));
      result.push({ id, description: tab.description, icon: tab.icon, tabType: "process" });
    }
  }
  return result;
}

function buildCategoryDefs(
  sidebarItems: readonly SidebarItem[],
  processes: Map<string, ManagedProcess>,
): readonly CategoryDef[] {
  return sidebarItems.map((item) => {
    if (item.files) return buildFileCategoryDef(item);
    const tabs = buildProcessTabs(item, processes);
    return { name: item.category, icon: item.icon, type: "process" as const, tabs };
  });
}

function resolveHostname(hostname: string): string {
  return hostname === "0.0.0.0" || hostname === "127.0.0.1" ? "localhost" : hostname;
}

export async function wmux(config: WmuxConfig): Promise<WmuxHandle> {
  const port = config.port ?? 0;
  const hostname = config.hostname ?? "127.0.0.1";
  const token = config.token ?? generateToken();
  const clientUrl = config.clientUrl
    ?? process.env["WMUX_CLIENT_URL"]
    ?? (BUILT_IN_CLIENT_URL.startsWith("__") ? "http://localhost:5173" : BUILT_IN_CLIENT_URL);

  const processes = new Map<string, ManagedProcess>();
  const categoryDefs = buildCategoryDefs(config.sidebarItems, processes);

  const { transport, server, stop: stopServer } = createWmuxServer({ port, hostname, token, clientUrl });
  const actualPort = server.port ?? port;
  const displayHost = resolveHostname(hostname);
  const wsUrl = `ws://${displayHost}:${actualPort}/ws`;
  const fullClientUrl = `${clientUrl}/#token=${encodeURIComponent(token)}&ws=${encodeURIComponent(wsUrl)}`;

  console.log(`\x1b[1m\x1b[32mwmux\x1b[0m → \x1b[4m${fullClientUrl}\x1b[0m`);
  console.log(`\x1b[2m       ws://${hostname}:${actualPort}/ws\x1b[0m`);

  if (config.open !== false) {
    openBrowser(`http://${displayHost}:${actualPort}/`);
  }

  Render(
    <Server transport={transport} singleInstance>
      {() => <WmuxRoot title={config.title ?? "wmux"} description={config.description ?? ""} processes={processes} categoryDefs={categoryDefs} />}
    </Server>,
  );

  const stop = (): void => {
    for (const proc of processes.values()) proc.dispose();
    stopServer();
  };

  process.on("SIGINT", () => { stop(); process.exit(0); });
  process.on("SIGTERM", () => { stop(); process.exit(0); });

  return { url: fullClientUrl, localUrl: wsUrl, port: actualPort, token, wsUrl, stop };
}
