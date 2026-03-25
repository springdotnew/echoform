[![fullstack](./assets/Logo.png)](#)

<p align="center">
  A React framework for building React applications with server-side executing
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@playfast/echoform"><img alt="NPM Version" src="https://img.shields.io/npm/v/@playfast/echoform?style=for-the-badge"></a>
  <a href="https://www.npmjs.com/package/@playfast/echoform"><img alt="NPM Downloads" src="https://img.shields.io/npm/dt/@playfast/echoform?style=for-the-badge"></a>
</p>

Build web UIs where all logic stays on the server. The browser is just a screen.

echoform is for dev tools, local apps, and anywhere you want a web interface without building an API layer. You write React on the server — state, callbacks, streaming — and echoform handles the rest.

## How it works

The opposite of server-side rendering: the client renders UI components, the server runs business logic. State management, data fetching, and layout decisions happen on the server. User interactions (clicks, input) run on the client and are forwarded to the server as callbacks.

Data flow:
`client action` → `server callback` → `server state update` → `client view update` (over WebSocket)

This eliminates the HTTP request/response cycle for data fetching — the server pushes updates directly. For data-heavy views this is faster than traditional React apps. For purely client-side interactions with no server state, a traditional approach may be faster.

## Use cases
["web-desktop-environment"](https://github.com/shmuelhizmi/web-desktop-environment) is a project built on top of "echoform" that benefits from the tight connection between server and client. Moving the entire server logic to React components made the codebase more readable and organized.

[@playfast/wmux](https://www.npmjs.com/package/@playfast/wmux) is a web terminal multiplexer for dev servers built with "echoform". It uses server-side React components to manage PTY terminals, iframe tabs, and file browsing sessions, streaming terminal output to the client via echoform's stream primitives while handling user input through callbacks — all over a single WebSocket connection.

# Getting Started

An echoform app has three parts: a **shared** view contract, a **server** that runs logic, and a **client** that renders UI.

```bash
bun add @playfast/echoform @playfast/echoform-render
bun add @playfast/echoform-bun-ws-server  # server transport
bun add @playfast/echoform-bun-ws-client   # client transport
bun add zod  # or valibot, arktype — any Standard Schema library
```

### 1. Define the contract

```ts
// shared/views.ts
import { view, callback, createViews } from "@playfast/echoform";
import { z } from "zod";

export const Home = view("Home", {
  input: { username: z.string() },
  callbacks: { logout: callback() },
});

export const Login = view("Login", {
  callbacks: {
    login: callback({ input: z.object({ username: z.string(), password: z.string() }) }),
  },
});

export const Prompt = view("Prompt", {
  input: { message: z.string() },
  callbacks: { onOk: callback() },
});

export const views = createViews({ Home, Login, Prompt });
```

### 2. Server — all logic lives here

```tsx
// server/index.tsx
import { useState } from "react";
import { Render } from "@playfast/echoform-render";
import { Server } from "@playfast/echoform/server";
import { createBunWebSocketServer } from "@playfast/echoform-bun-ws-server";
import { Home, Login, Prompt } from "../shared/views";

function App() {
  const [location, setLocation] = useState<"home" | "error" | "login">("login");
  const [name, setName] = useState("");

  return (
    <>
      {location === "login" && (
        <Login
          login={({ username, password }) => {
            if (password === "0000") {
              setName(username);
              setLocation("home");
            } else {
              setLocation("error");
            }
          }}
        />
      )}
      {location === "home" && (
        <Home username={name} logout={() => setLocation("login")} />
      )}
      {location === "error" && (
        <Prompt message="Wrong password" onOk={() => setLocation("login")} />
      )}
    </>
  );
}

const { transport, start } = createBunWebSocketServer({ port: 8485, path: "/ws" });
start();

Render(
  <Server transport={transport}>
    {() => <App />}
  </Server>
);
```

### 3. Client — just renders what the server sends

```tsx
// client/index.tsx
import { Client } from "@playfast/echoform/client";
import { useWebSocketTransport } from "@playfast/echoform-bun-ws-client";
import type { InferClientProps } from "@playfast/echoform/client";
import { Home as HomeDef, Login as LoginDef, Prompt as PromptDef } from "../shared/views";

function Home({ username, logout }: InferClientProps<typeof HomeDef>) {
  return (
    <div>
      <h1>Hello - {username}</h1>
      <button onClick={() => logout.mutate()}>Logout</button>
    </div>
  );
}

function Login({ login }: InferClientProps<typeof LoginDef>) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  return (
    <div>
      <input type="text" onChange={(e) => setUsername(e.target.value)} placeholder="username" />
      <input type="password" onChange={(e) => setPassword(e.target.value)} placeholder="password" />
      <button onClick={() => login.mutate({ username, password })}>Log In</button>
    </div>
  );
}

function Prompt({ message, onOk }: InferClientProps<typeof PromptDef>) {
  return (
    <div>
      <h1>{message}</h1>
      <button onClick={() => onOk.mutate()}>OK</button>
    </div>
  );
}

function App() {
  const { transport } = useWebSocketTransport("ws://localhost:8485/ws");
  if (!transport) return <div>Connecting...</div>;
  return <Client transport={transport} views={{ Home, Login, Prompt }} />;
}
```

Callbacks use `.mutate()` on the client and return promises. Streams use `.subscribe()`. See the [root README](../../README.md) for a full example with streams.
