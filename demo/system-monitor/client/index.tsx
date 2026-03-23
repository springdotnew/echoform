import React from "react";
import { createRoot } from "react-dom/client";
import { Client } from "@playfast/echoform/client";
import { useWebSocketTransport } from "@playfast/echoform-bun-ws-client";
import { Dashboard, ProcessTable, LogStream } from "./components";

const components = { Dashboard, ProcessTable, LogStream };

function App(): React.ReactElement {
  const { transport, error } = useWebSocketTransport("ws://localhost:4231/ws");

  if (error) {
    return <div style={{ padding: 20, color: "#f85149", fontFamily: "system-ui", fontSize: 13 }}>Connection error: {error}</div>;
  }

  if (!transport) {
    return <div style={{ padding: 20, color: "#484f58", fontFamily: "system-ui", fontSize: 13 }}>Connecting...</div>;
  }

  return <Client transport={transport} views={components} />;
}

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#0d1117", color: "#c9d1d9", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" }}>
      <App />
    </div>,
  );
}
