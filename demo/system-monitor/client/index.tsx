import React from "react";
import { createRoot } from "react-dom/client";
import { Reshaped } from "reshaped/bundle";
import "reshaped/bundle.css";
import "reshaped/themes/slate/theme.css";
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
    return <Reshaped theme="slate" defaultColorMode="dark">Connection error: {error}</Reshaped>;
  }

  if (!transport) {
    return <Reshaped theme="slate" defaultColorMode="dark">Connecting...</Reshaped>;
  }

  return (
    <Reshaped theme="slate" defaultColorMode="dark">
      <Client transport={transport} views={components} />
    </Reshaped>
  );
}

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
