import { view, callback, createViews } from "@playfast/echoform";
import { z } from "zod";

export const TodoApp = view("TodoApp", {
  input: {
    title: z.string(),
    itemCount: z.number(),
    completedCount: z.number(),
  },
});

export const TodoInput = view("TodoInput", {
  input: { placeholder: z.string() },
  callbacks: { onAdd: callback({ input: z.string() }) },
});

export const TodoList = view("TodoList", {});

export const TodoItem = view("TodoItem", {
  input: {
    id: z.string(),
    text: z.string(),
    completed: z.boolean(),
  },
  callbacks: {
    onToggle: callback(),
    onDelete: callback(),
  },
});

export const FilterButtons = view("FilterButtons", {
  input: { filter: z.enum(["all", "active", "completed"]) },
  callbacks: {
    onFilterChange: callback({ input: z.enum(["all", "active", "completed"]) }),
    onClearCompleted: callback(),
  },
});

export const views = createViews({ TodoApp, TodoInput, TodoList, TodoItem, FilterButtons });
