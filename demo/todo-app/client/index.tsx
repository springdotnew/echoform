import React from "react";
import { mountDemoClient } from "../../shared/DemoClient";
import { TodoApp, TodoInput, TodoList, TodoItem, FilterButtons } from "./components";

mountDemoClient({
  wsUrl: "ws://localhost:4201/ws",
  views: { TodoApp, TodoInput, TodoList, TodoItem, FilterButtons },
  wrapper: (client) => (
    <div style={{ minHeight: "100vh", backgroundColor: "#f0f0f0", padding: "20px" }}>
      {client}
    </div>
  ),
});
