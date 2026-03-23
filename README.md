# echoform

Build web UIs where all logic stays on the server. The browser is just a screen.

echoform is for dev tools, local apps, and anywhere you want a web interface without building an API layer. You write React on the server — state, callbacks, streaming — and echoform handles the rest.

```bash
bun add @playfast/echoform @playfast/echoform-render
bun add @playfast/echoform-bun-ws-server  # server
bun add @playfast/echoform-bun-ws-client   # client
bun add zod  # or valibot, arktype — any Standard Schema library
```

## Example: System Monitor

A live process monitor in ~40 lines of server code. The client is just HTML — zero business logic.

> [Full source](demo/system-monitor)

### 1. Define the contract

```typescript
// shared/views.ts
import { view, callback, stream, createViews } from "@playfast/echoform";
import { z } from "zod";

export const Dashboard = view("Dashboard", {
  input: {
    hostname: z.string(),
    cpuUsage: z.number(),
    memoryUsed: z.number(),
    memoryTotal: z.number(),
  },
});

export const ProcessTable = view("ProcessTable", {
  input: {
    processes: z.array(z.object({
      pid: z.number(), name: z.string(), cpu: z.number(), memory: z.number(),
    })),
  },
  callbacks: {
    onKill: callback({ input: z.number() }),
    onRefresh: callback(),
  },
});

export const LogStream = view("LogStream", {
  streams: { lines: stream(z.string()) },
});

export const views = createViews({ Dashboard, ProcessTable, LogStream });
```

### 2. Server — all logic lives here

```typescript
// server/index.tsx
import os from "os";
import { Render } from "@playfast/echoform-render";
import { Server, useViews, useStream } from "@playfast/echoform/server";
import { createBunWebSocketServer } from "@playfast/echoform-bun-ws-server";
import { views, LogStream } from "../shared/views";

function Monitor() {
  const View = useViews(views);
  const log = useStream(LogStream, "lines");
  const [processes, setProcesses] = useState([]);

  useEffect(() => {
    const refresh = async () => {
      setProcesses(await getProcessList());
    };
    refresh();
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, []);

  if (!View) return null;

  return (
    <>
      <View.Dashboard
        hostname={os.hostname()}
        cpuUsage={getCpuUsage()}
        memoryUsed={os.totalmem() - os.freemem()}
        memoryTotal={os.totalmem()}
      />
      <View.ProcessTable
        processes={processes}
        onKill={(pid) => {
          process.kill(pid, "SIGTERM");
          log.emit(`Killed PID ${pid}`);
        }}
        onRefresh={() => refresh()}
      />
      <View.LogStream lines={log} />
    </>
  );
}

const { transport, start } = createBunWebSocketServer({ port: 4231, path: "/ws" });
start();

Render(
  <Server transport={transport}>
    {() => <Monitor />}
  </Server>
);
```

### 3. Client — just renders what the server sends

```typescript
// client/index.tsx
import { Client } from "@playfast/echoform/client";
import { useWebSocketTransport } from "@playfast/echoform-bun-ws-client";
import { Dashboard, ProcessTable, LogStream } from "./components";

function App() {
  const { transport } = useWebSocketTransport("ws://localhost:4231/ws");
  if (!transport) return <div>Connecting...</div>;
  return <Client transport={transport} views={{ Dashboard, ProcessTable, LogStream }} />;
}
```

Client components receive typed props — `.mutate()` for callbacks, `.subscribe()` for streams:

```typescript
// client/components.tsx
function ProcessTable({ processes, onKill, onRefresh }: InferClientProps<typeof ProcessTableDef>) {
  return (
    <table>
      {processes.map((proc) => (
        <tr key={proc.pid}>
          <td>{proc.name}</td>
          <td>{proc.cpu}%</td>
          <td><button onClick={() => onKill.mutate(proc.pid)}>Kill</button></td>
        </tr>
      ))}
      <button onClick={() => onRefresh.mutate()}>Refresh</button>
    </table>
  );
}
```

The server reads system data, manages state, handles kill signals. The client is a dumb terminal. echoform bridges them transparently over WebSocket.

## API

### View Builders (`@playfast/echoform`)

| Function | Description |
|----------|-------------|
| `view(name, config)` | Define a view with input, callbacks, and streams |
| `callback(config?)` | Define a callback with optional input/output schemas |
| `stream(schema)` | Define a server→client stream with chunk schema |
| `createViews(record)` | Compose view definitions into a registry |

### Server (`@playfast/echoform/server`)

| Export | Description |
|--------|-------------|
| `useViews(viewDefs)` | Get typed view components for rendering |
| `useStream(viewDef, name)` | Create a `StreamEmitter` for pushing data to clients |
| `Server` | Root component that manages client connections |

### Client (`@playfast/echoform/client`)

| Export | Description |
|--------|-------------|
| `Client` | Root component that renders views from the server |
| `InferClientProps<V>` | Infer client-side props from a view definition |

### Client Callback Shape

```typescript
callback.mutate(input)        // Call the server handler, returns Promise
callback.queryOptions()       // { mutationFn, mutationKey } for useMutation
```

### Client Stream Shape

```typescript
stream.subscribe(listener)    // Returns unsubscribe function
```

### Transport (`@playfast/echoform-bun-ws-client`)

```typescript
const { transport, error, status } = useWebSocketTransport(url);
```

## Packages

- [@playfast/echoform](packages/fullstack) — core framework
- [@playfast/echoform-render](packages/react-render-null) — server-side React renderer

## Transport Plugins

- [@playfast/echoform-bun-ws-server](plugins/fullstack/bun-ws-server) — Bun WebSocket server
- [@playfast/echoform-bun-ws-client](plugins/fullstack/bun-ws-client) — WebSocket client hook
- [@playfast/echoform-socket-server](plugins/fullstack/socket-server) — Socket.io server
- [@playfast/echoform-socket-client](plugins/fullstack/socket-client) — Socket.io client

## Demos

- [System Monitor](demo/system-monitor) — live process monitor with kill, streams, and system stats
- [Todo App](demo/todo-app) — CRUD with callbacks and zod schemas
- [File Editor](demo/file-editor) — Monaco editor with file tree
- [Dev Server](demo/dev-server) — multi-process terminal dashboard
