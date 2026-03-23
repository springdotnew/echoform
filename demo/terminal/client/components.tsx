import React, { useState, useEffect, useRef } from "react";
import type { InferClientProps } from "@react-fullstack/fullstack/client";
import type { Terminal as TerminalDef } from "../shared/views";

export function Terminal({
  title,
  output,
  onInput,
}: InferClientProps<typeof TerminalDef>): React.ReactElement {
  const [lines, setLines] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = output.subscribe((chunk: string) => {
      if (chunk === "\x1b[CLEAR]") {
        setLines([]);
        return;
      }
      setLines((prev) => {
        // Append chunk to the last line or add a new line
        const updated = [...prev];
        const parts = chunk.split("\n");
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i]!;
          if (i === 0 && updated.length > 0) {
            updated[updated.length - 1] = updated[updated.length - 1]! + part;
          } else {
            updated.push(part);
          }
        }
        return updated;
      });
    });
    return unsubscribe;
  }, [output]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [lines]);

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    onInput.mutate(inputValue);
    setInputValue("");
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>{title}</h1>
      </div>
      <div ref={outputRef} style={styles.output} data-testid="terminal-output">
        {lines.map((line, i) => (
          <div key={i} style={styles.line}>
            {line || "\u00A0"}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} style={styles.inputRow}>
        <span style={styles.prompt}>&gt;</span>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          style={styles.input}
          placeholder="Type a command..."
          autoFocus
          data-testid="terminal-input"
        />
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    backgroundColor: "#1e1e1e",
    color: "#d4d4d4",
    fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
    fontSize: "14px",
  },
  header: {
    padding: "8px 16px",
    backgroundColor: "#252526",
    borderBottom: "1px solid #3c3c3c",
  },
  title: {
    margin: 0,
    fontSize: "16px",
    fontWeight: 600,
    color: "#cccccc",
  },
  output: {
    flex: 1,
    overflow: "auto",
    padding: "12px 16px",
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
  },
  line: {
    lineHeight: "1.5",
    minHeight: "21px",
  },
  inputRow: {
    display: "flex",
    alignItems: "center",
    padding: "8px 16px",
    borderTop: "1px solid #3c3c3c",
    backgroundColor: "#252526",
  },
  prompt: {
    color: "#569cd6",
    marginRight: "8px",
    fontWeight: "bold",
  },
  input: {
    flex: 1,
    backgroundColor: "transparent",
    border: "none",
    outline: "none",
    color: "#d4d4d4",
    fontFamily: "inherit",
    fontSize: "inherit",
  },
};
