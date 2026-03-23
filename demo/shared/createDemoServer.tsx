import React from "react";
import { Render } from "@react-fullstack/render";
import { Server } from "@react-fullstack/fullstack/server";
import { createBunWebSocketServer } from "@react-fullstack/fullstack-bun-ws-server";

interface DemoServerOptions {
  readonly defaultPort: number;
  readonly path?: string;
  readonly singleInstance?: boolean;
  readonly label?: string;
}

export function createDemoServer(
  AppComponent: () => React.ReactElement | null,
  options: DemoServerOptions,
): void {
  const { defaultPort, path = "/ws", singleInstance, label } = options;
  const PORT = parseInt(process.env.PORT ?? String(defaultPort), 10);
  const { transport, start } = createBunWebSocketServer({ port: PORT, path });
  const server = start();

  console.log(`${label ?? "Server"} running on ws://localhost:${PORT}${path}`);

  process.on("SIGINT", () => { server.stop(); process.exit(0); });
  process.on("SIGTERM", () => { server.stop(); process.exit(0); });

  Render(
    <Server transport={transport} singleInstance={singleInstance}>
      {() => <AppComponent />}
    </Server>
  );
}
