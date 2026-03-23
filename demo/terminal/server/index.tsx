import React, { useEffect, useRef } from "react";
import { Render } from "@react-fullstack/render";
import { Server, useViews, useStream } from "@react-fullstack/fullstack/server";
import { createBunWebSocketServer } from "@react-fullstack/fullstack-bun-ws-server";
import { views, Terminal } from "../shared/views";

// Base64 helpers for binary-safe transport over JSON
function toBase64(data: Uint8Array): string {
  return Buffer.from(data).toString("base64");
}

function fromBase64(data: string): Uint8Array {
  return Buffer.from(data, "base64");
}

function TerminalApp(): React.ReactElement | null {
  const View = useViews(views);
  const output = useStream(Terminal, "output");

  const terminalRef = useRef<{
    write: (data: string | Uint8Array) => void;
    resize: (cols: number, rows: number) => void;
    close: () => void;
  } | null>(null);

  useEffect(() => {
    const shell = process.env.SHELL ?? "/bin/bash";

    const proc = Bun.spawn([shell], {
      terminal: {
        cols: 80,
        rows: 24,
        data(_terminal, data: Uint8Array) {
          // PTY output → base64 encode → stream to client
          output.emit(toBase64(data));
        },
      },
    });

    terminalRef.current = proc.terminal!;

    return () => {
      terminalRef.current?.close();
      terminalRef.current = null;
    };
  }, [output]);

  if (!View) return null;

  return (
    <View.Terminal
      title="Terminal"
      output={output}
      onInput={(b64Input) => {
        // Client sends base64-encoded keystrokes → decode → write to PTY
        terminalRef.current?.write(fromBase64(b64Input));
      }}
      onResize={({ cols, rows }) => {
        terminalRef.current?.resize(cols, rows);
      }}
    />
  );
}

const PORT = parseInt(process.env.PORT ?? "4220", 10);

const { transport, start } = createBunWebSocketServer({
  port: PORT,
  path: "/ws",
});

const server = start();

console.log(`Terminal server running on ws://localhost:${PORT}/ws`);

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
