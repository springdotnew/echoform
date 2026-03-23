import React, { useCallback } from "react";
import { Render } from "@react-fullstack/render";
import { Server, useViews, useStream } from "@react-fullstack/fullstack/server";
import { createBunWebSocketServer } from "@react-fullstack/fullstack-bun-ws-server";
import { views, Terminal } from "../shared/views";

function TerminalApp(): React.ReactElement | null {
  const View = useViews(views);
  const output = useStream(Terminal, "output");

  // Emit a welcome message once the stream is available
  const welcomeSent = React.useRef(false);
  if (!welcomeSent.current) {
    welcomeSent.current = true;
    // Use setTimeout to ensure the stream is wired up on the client side
    setTimeout(() => {
      output.emit("Welcome to the react-fullstack terminal demo!\n");
      output.emit("Type a command and press Enter.\n");
      output.emit("$ ");
    }, 100);
  }

  const handleInput = useCallback(
    (input: string) => {
      // Echo the command, then produce a response
      output.emit(input + "\n");

      const trimmed = input.trim();
      if (trimmed === "") {
        output.emit("$ ");
        return;
      }

      if (trimmed === "help") {
        output.emit("Available commands: help, echo <text>, date, clear, whoami\n");
      } else if (trimmed === "date") {
        output.emit(new Date().toISOString() + "\n");
      } else if (trimmed === "whoami") {
        output.emit("react-fullstack-user\n");
      } else if (trimmed === "clear") {
        // Send a special clear marker
        output.emit("\x1b[CLEAR]");
      } else if (trimmed.startsWith("echo ")) {
        output.emit(trimmed.slice(5) + "\n");
      } else {
        output.emit(`command not found: ${trimmed}\n`);
      }

      output.emit("$ ");
    },
    [output],
  );

  if (!View) {
    return null;
  }

  return (
    <View.Terminal
      title="Terminal Demo"
      onInput={handleInput}
      output={output}
    />
  );
}

const PORT = parseInt(process.env.PORT ?? "4220", 10);

const { transport, start } = createBunWebSocketServer({
  port: PORT,
  path: "/ws",
});

const server = start();

console.log(`Server running on http://localhost:${PORT}`);
console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`);

process.on("SIGINT", () => {
  server.stop();
  process.exit(0);
});
process.on("SIGTERM", () => {
  server.stop();
  process.exit(0);
});

Render(
  <Server transport={transport}>
    {() => <TerminalApp />}
  </Server>
);
