import React from "react";
import { createRoot } from "react-dom/client";
import { Client } from "@play/echoform/client";
import { useWebSocketTransport } from "@play/echoform-bun-ws-client";
import {
  App,
  FileTree,
  TabBar,
  CodeEditor,
  ExcalidrawEditor,
  EmptyEditor,
  ErrorDisplay,
} from "./components";

const components = {
  App,
  FileTree,
  TabBar,
  CodeEditor,
  ExcalidrawEditor,
  EmptyEditor,
  ErrorDisplay,
};

function Root(): React.ReactElement {
  const { transport, error } = useWebSocketTransport("ws://localhost:4210/ws");

  if (error) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#ff4444" }}>
        Connection error: {error}
      </div>
    );
  }

  if (!transport) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#888" }}>
        Connecting...
      </div>
    );
  }

  return <Client transport={transport} views={components} requestViewTreeOnMount />;
}

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<Root />);
}
