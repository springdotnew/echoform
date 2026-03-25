/** @jsxImportSource @opentui/react */
import type { ReactNode } from "react";

interface WmuxFileContentProps {
  readonly id: string;
  readonly path: string;
  readonly name: string;
  readonly content: string;
  readonly children?: ReactNode;
}

export const WmuxFileContent = ({ name, content }: WmuxFileContentProps): ReactNode => {
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
