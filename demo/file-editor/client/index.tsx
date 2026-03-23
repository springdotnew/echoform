import React from "react";
import { createRoot } from "react-dom/client";
import { Client } from "@react-fullstack/fullstack/client";
import type { ViewsToComponents } from "@react-fullstack/fullstack/client";
import { useWebSocketTransport } from "@react-fullstack/fullstack-bun-ws-client";
import type { Views } from "../shared/views";
import {
  App,
  FileTree,
  TabBar,
  CodeEditor,
  ExcalidrawEditor,
  EmptyEditor,
  ErrorDisplay,
} from "./components";

const views: ViewsToComponents<Views> = {
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

  return <Client transport={transport} views={views} requestViewTreeOnMount />;
}

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<Root />);
}
