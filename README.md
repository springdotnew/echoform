# React Fullstack

A framework for building fullstack React applications with server-driven UI, type-safe RPC callbacks, and streaming — powered by Standard Schema validation.

## Quick Start

```bash
bun add @react-fullstack/fullstack @react-fullstack/render
bun add @react-fullstack/fullstack-bun-ws-server  # server
bun add @react-fullstack/fullstack-bun-ws-client   # client
bun add zod  # or valibot, arktype — any Standard Schema library
```

## Define Views

Views are the shared contract between server and client. Each view declares its **input** (data props), **callbacks** (client→server RPC), and **streams** (server→client push).

```typescript
// shared/views.ts
import { view, callback, stream, createViews } from "@react-fullstack/fullstack";
import { z } from "zod";

export const TodoApp = view("TodoApp", {
  input: {
    title: z.string(),
    itemCount: z.number(),
    completedCount: z.number(),
  },
});

export const TodoInput = view("TodoInput", {
  input: { placeholder: z.string() },
  callbacks: { onAdd: callback({ input: z.string() }) },
});

export const Terminal = view("Terminal", {
  input: { title: z.string() },
  callbacks: { onInput: callback({ input: z.string() }) },
  streams: { output: stream(z.string()) },
});

export const views = createViews({ TodoApp, TodoInput, Terminal });
```

## Server

The server renders React components that map to views. State lives on the server — the client is a thin rendering layer.

```typescript
// server/index.tsx
import { Render } from "@react-fullstack/render";
import { Server, useViews, useStream } from "@react-fullstack/fullstack/server";
import { createBunWebSocketServer } from "@react-fullstack/fullstack-bun-ws-server";
import { views, Terminal } from "../shared/views";

function App() {
  const View = useViews(views);
  const output = useStream(Terminal, "output");

  // Stream: server pushes data to client
  useEffect(() => {
    const interval = setInterval(() => {
      output.emit("heartbeat " + Date.now());
    }, 1000);
    return () => { clearInterval(interval); output.end(); };
  }, []);

  if (!View) return null;

  return (
    <View.Terminal
      title="My Terminal"
      output={output}
      onInput={(text) => {
        // Callback: client sends data to server
        output.emit("echo: " + text);
      }}
    />
  );
}

const { transport, start } = createBunWebSocketServer({ port: 4201, path: "/ws" });
start();

Render(
  <Server transport={transport}>
    {() => <App />}
  </Server>
);
```

## Client

Client components receive typed props with `.mutate()` for callbacks and `.subscribe()` for streams.

```typescript
// client/components.tsx
import type { InferClientProps } from "@react-fullstack/fullstack/client";
import { Terminal as TerminalDef } from "../shared/views";

function Terminal(props: InferClientProps<typeof TerminalDef>) {
  const [lines, setLines] = useState<string[]>([]);

  // Subscribe to server stream
  useEffect(() => {
    return props.output.subscribe((line) => {
      setLines((prev) => [...prev, line]);
    });
  }, [props.output]);

  // Call server callback
  const handleSubmit = (text: string) => {
    props.onInput.mutate(text);
  };

  // TanStack Query integration
  const mutation = useMutation(props.onInput.queryOptions());

  return <div>{lines.map((l, i) => <div key={i}>{l}</div>)}</div>;
}
```

```typescript
// client/index.tsx
import { Client } from "@react-fullstack/fullstack/client";
import { useWebSocketTransport } from "@react-fullstack/fullstack-bun-ws-client";

function App() {
  const { transport, error } = useWebSocketTransport("ws://localhost:4201/ws");
  if (!transport) return <div>Connecting...</div>;
  return <Client transport={transport} views={{ Terminal }} requestViewTreeOnMount />;
}
```

## API

### View Builders (`@react-fullstack/fullstack`)

| Function | Description |
|----------|-------------|
| `view(name, config)` | Define a view with input, callbacks, and streams |
| `callback(config?)` | Define a callback with optional input/output schemas |
| `stream(schema)` | Define a server→client stream with chunk schema |
| `createViews(record)` | Compose view definitions into a registry |

### Server (`@react-fullstack/fullstack/server`)

| Export | Description |
|--------|-------------|
| `useViews(viewDefs)` | Get typed view components for rendering |
| `useStream(viewDef, name)` | Create a `StreamEmitter` for pushing data to clients |
| `Server` | Root component that manages client connections |

### Client (`@react-fullstack/fullstack/client`)

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

### Transport (`@react-fullstack/fullstack-bun-ws-client`)

```typescript
const { transport, error, isConnected } = useWebSocketTransport(url);
```

## Packages

- [@react-fullstack/fullstack](packages/fullstack) — core framework
- [@react-fullstack/render](packages/react-render-null) — server-side React renderer

## Transport Plugins

- [@react-fullstack/fullstack-bun-ws-server](plugins/fullstack/bun-ws-server) — Bun WebSocket server
- [@react-fullstack/fullstack-bun-ws-client](plugins/fullstack/bun-ws-client) — WebSocket client hook
- [@react-fullstack/fullstack-socket-server](plugins/fullstack/socket-server) — Socket.io server
- [@react-fullstack/fullstack-socket-client](plugins/fullstack/socket-client) — Socket.io client

## Demos

- [Todo App](demo/todo-app) — CRUD with callbacks and zod schemas
- [File Editor](demo/file-editor) — Monaco editor with file tree
- [Terminal](demo/terminal) — streaming terminal with PTY
