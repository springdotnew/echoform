import React, { useState, type ReactNode } from "react";

interface TodoAppProps {
  title: string;
  itemCount: number;
  completedCount: number;
  children?: ReactNode;
}

export function TodoApp({ title, itemCount, completedCount, children }: TodoAppProps): React.ReactElement {
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>{title}</h1>
        <p style={styles.stats}>
          {completedCount} of {itemCount} completed
        </p>
      </header>
      <main style={styles.main}>{children}</main>
    </div>
  );
}

interface TodoInputProps {
  placeholder: string;
  onAdd: (text: string) => void;
}

export function TodoInput({ placeholder, onAdd }: TodoInputProps): React.ReactElement {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (value.trim()) {
      onAdd(value);
      setValue("");
    }
  };

  return (
    <form onSubmit={handleSubmit} style={styles.inputForm}>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        style={styles.input}
      />
      <button type="submit" style={styles.addButton}>
        Add
      </button>
    </form>
  );
}

interface TodoListProps {
  children?: ReactNode;
}

export function TodoList({ children }: TodoListProps): React.ReactElement {
  return <ul style={styles.list}>{children}</ul>;
}

interface TodoItemProps {
  id: string;
  text: string;
  completed: boolean;
  onToggle: () => void;
  onDelete: () => void;
}

export function TodoItem({ text, completed, onToggle, onDelete }: TodoItemProps): React.ReactElement {
  return (
    <li style={styles.item}>
      <label style={styles.itemLabel}>
        <input
          type="checkbox"
          checked={completed}
          onChange={onToggle}
          style={styles.checkbox}
        />
        <span style={{ ...styles.itemText, ...(completed ? styles.completed : {}) }}>
          {text}
        </span>
      </label>
      <button onClick={onDelete} style={styles.deleteButton}>
        Delete
      </button>
    </li>
  );
}

interface FilterButtonsProps {
  filter: "all" | "active" | "completed";
  onFilterChange: (filter: "all" | "active" | "completed") => void;
  onClearCompleted: () => void;
}

export function FilterButtons({ filter, onFilterChange, onClearCompleted }: FilterButtonsProps): React.ReactElement {
  return (
    <footer style={styles.footer}>
      <div style={styles.filters}>
        {(["all", "active", "completed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => onFilterChange(f)}
            style={{
              ...styles.filterButton,
              ...(filter === f ? styles.activeFilter : {}),
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      <button onClick={onClearCompleted} style={styles.clearButton}>
        Clear Completed
      </button>
    </footer>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: "500px",
    margin: "40px auto",
    padding: "20px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    backgroundColor: "#fff",
    borderRadius: "8px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
  },
  header: {
    textAlign: "center",
    marginBottom: "20px",
  },
  title: {
    margin: "0 0 8px 0",
    color: "#333",
    fontSize: "28px",
  },
  stats: {
    margin: 0,
    color: "#666",
    fontSize: "14px",
  },
  main: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  inputForm: {
    display: "flex",
    gap: "8px",
  },
  input: {
    flex: 1,
    padding: "12px",
    fontSize: "16px",
    border: "1px solid #ddd",
    borderRadius: "4px",
    outline: "none",
  },
  addButton: {
    padding: "12px 24px",
    fontSize: "16px",
    backgroundColor: "#4CAF50",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
  list: {
    listStyle: "none",
    padding: 0,
    margin: 0,
  },
  item: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px",
    backgroundColor: "#f9f9f9",
    borderRadius: "4px",
    marginBottom: "8px",
  },
  itemLabel: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    cursor: "pointer",
    flex: 1,
  },
  checkbox: {
    width: "20px",
    height: "20px",
    cursor: "pointer",
  },
  itemText: {
    fontSize: "16px",
    color: "#333",
  },
  completed: {
    textDecoration: "line-through",
    color: "#999",
  },
  deleteButton: {
    padding: "6px 12px",
    fontSize: "14px",
    backgroundColor: "#ff4444",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: "16px",
    borderTop: "1px solid #eee",
  },
  filters: {
    display: "flex",
    gap: "8px",
  },
  filterButton: {
    padding: "8px 16px",
    fontSize: "14px",
    backgroundColor: "#eee",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
  activeFilter: {
    backgroundColor: "#333",
    color: "white",
  },
  clearButton: {
    padding: "8px 16px",
    fontSize: "14px",
    backgroundColor: "transparent",
    border: "1px solid #ddd",
    borderRadius: "4px",
    cursor: "pointer",
    color: "#666",
  },
};
