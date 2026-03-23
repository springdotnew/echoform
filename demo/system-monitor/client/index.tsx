import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { Client } from "@playfast/echoform/client";
import { useWebSocketTransport } from "@playfast/echoform-bun-ws-client";
import { Dashboard, ProcessTable, LogStream } from "./components";

const components = { Dashboard, ProcessTable, LogStream };

function App(): React.ReactElement {
  const { transport, error } = useWebSocketTransport("ws://localhost:4231/ws");

  if (error) return <div className="p-6 text-danger text-sm">Connection error: {error}</div>;
  if (!transport) return <div className="p-6 text-default-400 text-sm">Connecting...</div>;

  return <Client transport={transport} views={components} />;
}

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<App />);
}
