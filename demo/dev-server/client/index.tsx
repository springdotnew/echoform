import React from "react";
import { createRoot } from "react-dom/client";
import { Client } from "@playfast/echoform/client";
import { useWebSocketTransport } from "@playfast/echoform-bun-ws-client";
import { DevServerApp, ProcessTerminal } from "./components";

const components = {
  DevServerApp,
  ProcessTerminal,
};

function App(): React.ReactElement {
  const { transport, error } = useWebSocketTransport("ws://localhost:4220/ws");

  if (error) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#ff4444" }}>
        Connection error: {error}
      </div>
    );
  }

  if (!transport) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#ccc" }}>
        Connecting...
      </div>
    );
  }

  return <Client transport={transport} views={components} requestViewTreeOnMount />;
}

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
