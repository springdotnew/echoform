import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Client } from "@react-fullstack/fullstack/client";
import type { ViewsToComponents } from "@react-fullstack/fullstack/client";
import { createWebSocketTransport } from "@react-fullstack/fullstack-bun-ws-client";
import type { Transport } from "@react-fullstack/fullstack";
import type { Views } from "../shared/views";
import { TodoApp, TodoInput, TodoList, TodoItem, FilterButtons } from "./components";

const views: ViewsToComponents<Views> = {
  TodoApp,
  TodoInput,
  TodoList,
  TodoItem,
  FilterButtons,
};

function App(): React.ReactElement {
  const [transport, setTransport] = useState<Transport<Record<string, unknown>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const wsTransport = createWebSocketTransport({ url: "ws://localhost:4201/ws" });

    wsTransport.connect()
      .then(() => {
        setTransport(wsTransport.transport);
      })
      .catch((err) => {
        setError((err as Error).message);
      });

    return () => {
      wsTransport.disconnect();
    };
  }, []);

  if (error) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#ff4444" }}>
        Connection error: {error}
      </div>
    );
  }

  if (!transport) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        Connecting...
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f0f0f0", padding: "20px" }}>
      <Client transport={transport} views={views} requestViewTreeOnMount />
    </div>
  );
}

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
