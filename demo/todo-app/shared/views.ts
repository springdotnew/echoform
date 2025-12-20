import type { View } from "@react-fullstack/fullstack";

export interface TodoItem {
  readonly id: string;
  readonly text: string;
  readonly completed: boolean;
}

export type Views = {
  readonly TodoApp: View<{
    readonly title: string;
    readonly itemCount: number;
    readonly completedCount: number;
  }>;
  readonly TodoInput: View<{
    readonly placeholder: string;
    readonly onAdd: (text: string) => void;
  }>;
  readonly TodoList: View<Record<string, unknown>>;
  readonly TodoItem: View<{
    readonly id: string;
    readonly text: string;
    readonly completed: boolean;
    readonly onToggle: () => void;
    readonly onDelete: () => void;
  }>;
  readonly FilterButtons: View<{
    readonly filter: "all" | "active" | "completed";
    readonly onFilterChange: (filter: "all" | "active" | "completed") => void;
    readonly onClearCompleted: () => void;
  }>;
};
