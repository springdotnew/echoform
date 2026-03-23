import React from "react";
import { createRoot } from "react-dom/client";
import { Client } from "@playfast/echoform/client";
import { useWebSocketTransport } from "@playfast/echoform-bun-ws-client";
import { TodoApp, TodoInput, TodoList, TodoItem, FilterButtons } from "./components";

const components = {
  TodoApp,
  TodoInput,
  TodoList,
  TodoItem,
  FilterButtons,
};

function App(): React.ReactElement {
  const { transport, error } = useWebSocketTransport("ws://localhost:4201/ws");

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
      <Client transport={transport} views={components} requestViewTreeOnMount />
    </div>
  );
}

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
