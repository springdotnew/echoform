import React, { useState, useCallback } from "react";
import { Render } from "@react-fullstack/render";
import { Server, useViews } from "@react-fullstack/fullstack/server";
import { createBunWebSocketServer } from "@react-fullstack/fullstack-bun-ws-server";
import type { Views, TodoItem } from "../shared/views";

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function TodoApp(): React.ReactElement | null {
  const View = useViews<Views>();

  const [todos, setTodos] = useState<ReadonlyArray<TodoItem>>([
    { id: generateId(), text: "Learn react-fullstack", completed: false },
    { id: generateId(), text: "Build something awesome", completed: false },
  ]);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");

  const addTodo = useCallback((text: string) => {
    if (text.trim()) {
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

  const filteredTodos = todos.filter((todo) => {
    if (filter === "active") return !todo.completed;
    if (filter === "completed") return todo.completed;
    return true;
  });

  const completedCount = todos.filter((t) => t.completed).length;

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

start();

console.log(`Server running on http://localhost:${PORT}`);
console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`);

Render(
  <Server transport={transport}>
    {() => <TodoApp />}
  </Server>
);
