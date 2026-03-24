# @playfast/wmux

Web terminal multiplexer for dev servers. Runs on [Bun](https://bun.sh).

Spawns processes with PTY support, serves a hosted web UI over WebSocket, and connects via [Local Network Access](https://github.com/nicjansma/local-network-access) — similar to Drizzle Studio or Bun's debugger.

## Install

```sh
bun i @playfast/wmux
```

## Quick start

```ts
import { wmux } from "@playfast/wmux";

await wmux({
  title: "my-app",
  description: "local dev",
  sidebarItems: [
    {
      category: "dev",
      icon: "Terminal",
      tabs: [
        { name: "server", process: { command: "bun run dev" } },
        { name: "shell", icon: "SquareTerminal", process: { command: "bash" } },
      ],
    },
  ],
});
```

Open the printed URL in your browser.

## API

### `wmux(config: WmuxConfig): Promise<WmuxHandle>`

```ts
interface WmuxConfig {
  title?: string;          // displayed in the top bar search button
  description?: string;    // shown next to the title in the top bar
  sidebarItems: SidebarItem[];
  port?: number;           // default: random
  hostname?: string;       // default: "127.0.0.1"
  clientUrl?: string;      // hosted client URL (auto-detected in CI builds)
  token?: string;          // auth token (auto-generated if omitted)
  open?: boolean;          // open browser on start (default: true)
}
```

Returns a handle:

```ts
interface WmuxHandle {
  url: string;       // full client URL with credentials
  localUrl: string;  // WebSocket URL
  port: number;
  stop: () => void;
}
```

### Sidebar items

Each sidebar item is either a **tab group** or a **file browser**:

```ts
// Tab group — processes and iframes
{
  category: "services",
  icon: "Server",             // optional, any Lucide icon name
  tabs: [
    { name: "api", description: "REST API", process: { command: "bun run dev" } },
    { name: "docs", url: "http://localhost:3001" },
  ],
}

// File browser
{
  category: "project",
  icon: "Folder",
  files: "./src",             // root directory to browse
}
```

### Tab config

```ts
interface TabConfig {
  name: string;
  description?: string;       // shown below the tab name in the sidebar
  icon?: string;              // Lucide icon name
  process?: ProcessConfig;    // terminal process
  url?: string;               // iframe URL
}
```

### Process config

```ts
// Command mode — wmux spawns the process with PTY
{
  command: "bun run dev",     // string or string[]
  cwd?: string,
  env?: Record<string, string>,
  autoStart?: boolean,        // default: true
  autoRestart?: boolean,      // restart on non-zero exit
}

// Terminal bridge mode — wrap an existing Bun.spawn terminal
import { wmux, createTerminalBridge } from "@playfast/wmux";

const bridge = createTerminalBridge();
const proc = Bun.spawn(["node"], { terminal: bridge.pty });

await wmux({
  sidebarItems: [{
    category: "external",
    tabs: [{ name: "node", process: { terminal: bridge.handle } }],
  }],
});
```

## Features

- PTY terminals via `Bun.spawn`
- Iframe tabs for web previews
- File browser with Monaco editor viewer
- VS Code-style top bar with search button
- Sidebar with collapsible categories and color-coded left borders
- Drag-to-reorder tabs
- Command palette (`Cmd+K`)
- Arrow key sidebar navigation (when terminal is not focused)
- Keyboard shortcuts (`Cmd+1-9` switch category, `Cmd+[/]` switch tab)
- Token-based WebSocket auth
- Auto-restart on crash
- Process start/stop/restart controls

## License

MIT
