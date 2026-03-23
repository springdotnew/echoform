import React from "react";
import { createRoot } from "react-dom/client";
import { Client } from "@playfast/echoform/client";
import { useWebSocketTransport } from "@playfast/echoform-bun-ws-client";
import { Dashboard, ProcessTable, LogStream } from "./components";

const components = {
  Dashboard,
  ProcessTable,
  LogStream,
};

function App(): React.ReactElement {
  const { transport, error } = useWebSocketTransport("ws://localhost:4231/ws");

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#e5534b", fontFamily: "system-ui" }}>
        Connection error: {error}
      </div>
    );
  }

  if (!transport) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#555", fontFamily: "system-ui" }}>
        Connecting...
      </div>
    );
  }

  return <Client transport={transport} views={components} />;
}

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#0e0e0e", color: "#d4d4d4", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <App />
    </div>,
  );
}
