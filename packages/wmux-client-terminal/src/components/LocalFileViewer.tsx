/** @jsxImportSource @opentui/react */
import { useState, useEffect, type ReactNode } from "react";
import { readFile } from "node:fs/promises";

interface LocalFileViewerProps {
  readonly filePath: string;
}

export const LocalFileViewer = ({ filePath }: LocalFileViewerProps): ReactNode => {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const name = filePath.split("/").pop() ?? filePath;

  useEffect(() => {
    let cancelled = false;
    setContent(null);
    setError(null);
    readFile(filePath, "utf-8")
      .then((text) => { if (!cancelled) setContent(text); })
      .catch((err) => { if (!cancelled) setError(String(err)); });
    return () => { cancelled = true; };
  }, [filePath]);

  if (error) {
    return (
      <box flexGrow={1} justifyContent="center" alignItems="center">
        <text fg="#ff453a">Failed to read: {name}</text>
      </box>
    );
  }

  if (content === null) {
    return (
      <box flexGrow={1} justifyContent="center" alignItems="center">
        <text fg="#636366">Loading {name}...</text>
      </box>
    );
  }

  const lines = content.split("\n");
  const gutterWidth = String(lines.length).length + 1;

  return (
    <box flexGrow={1} flexDirection="column">
      <box height={1} paddingX={1} backgroundColor="#2c2c2e">
        <text fg="#98989d">{name}</text>
      </box>
      <scrollbox flexGrow={1}>
        {lines.map((line, i) => (
          <text key={i}>
            <span fg="#48484a">{String(i + 1).padStart(gutterWidth, " ")} </span>
            <span fg="#e5e5ea">{line || " "}</span>
          </text>
        ))}
      </scrollbox>
    </box>
  );
};
