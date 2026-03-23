import React, { useState, useCallback } from "react";
import { Render } from "@play/echoform-render";
import { Server, useViews } from "@play/echoform/server";
import { createBunWebSocketServer } from "@play/echoform-bun-ws-server";
import { views } from "../shared/views";

interface TodoItem {
  readonly id: string;
  readonly text: string;
  readonly completed: boolean;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

type TodoFilter = "all" | "active" | "completed";

function shouldShowTodo(todo: TodoItem, filter: TodoFilter): boolean {
  if (filter === "active") return !todo.completed;
  if (filter === "completed") return todo.completed;
  return true;
}

function TodoApp(): React.ReactElement | null {
  const View = useViews(views);

  const [todos, setTodos] = useState<ReadonlyArray<TodoItem>>([
    { id: generateId(), text: "Learn echoform", completed: false },
    { id: generateId(), text: "Build something awesome", completed: false },
  ]);
  const [filter, setFilter] = useState<TodoFilter>("all");

  const addTodo = useCallback((text: string) => {
    if (typeof text === "string" && text.trim()) {
      setTodos((prev) => [
        ...prev,
        { id: generateId(), text: text.trim(), completed: false },
      ]);
    }
  }, []);

  const toggleTodo = useCallback((id: string) => {
    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  }, []);

  const deleteTodo = useCallback((id: string) => {
    setTodos((prev) => prev.filter((todo) => todo.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    setTodos((prev) => prev.filter((todo) => !todo.completed));
  }, []);

  if (!View) {
    return null;
  }

  const filteredTodos = todos.filter((todo) => shouldShowTodo(todo, filter));
  const completedCount = todos.filter((todo) => todo.completed).length;

  return (
    <View.TodoApp
      title="Todo List"
      itemCount={todos.length}
      completedCount={completedCount}
    >
      <View.TodoInput placeholder="What needs to be done?" onAdd={addTodo} />
      <View.TodoList>
        {filteredTodos.map((todo) => (
          <View.TodoItem
            key={todo.id}
            id={todo.id}
            text={todo.text}
            completed={todo.completed}
            onToggle={() => toggleTodo(todo.id)}
            onDelete={() => deleteTodo(todo.id)}
          />
        ))}
      </View.TodoList>
      <View.FilterButtons
        filter={filter}
        onFilterChange={setFilter}
        onClearCompleted={clearCompleted}
      />
    </View.TodoApp>
  );
}

const PORT = parseInt(process.env.PORT ?? "4201", 10);

const { transport, start } = createBunWebSocketServer({
  port: PORT,
  path: "/ws",
});

const server = start();

console.log(`Server running on http://localhost:${PORT}`);
console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`);

process.on("SIGINT", () => {
  server.stop();
  process.exit(0);
});
process.on("SIGTERM", () => {
  server.stop();
  process.exit(0);
});

Render(
  <Server transport={transport}>
    {() => <TodoApp />}
  </Server>
);
