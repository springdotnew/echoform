/** @jsxImportSource @opentui/react */
import type { ReactNode } from "react";

const MUTED = "#636366";
const ACCENT = "#0a84ff";
const WARN = "#ffd60a";

interface StatusBarProps {
  readonly prefixActive: boolean;
}

export const StatusBar = ({ prefixActive }: StatusBarProps): ReactNode => (
  <box height={1} flexDirection="row" paddingX={1} gap={2}>
    {prefixActive ? (
      <>
        <text fg={WARN}>
          <strong>wmux</strong>
        </text>
        <text fg={MUTED}>
          <span fg={ACCENT}>j/k</span> nav
        </text>
        <text fg={MUTED}>
          <span fg={ACCENT}>1-9</span> cat
        </text>
        <text fg={MUTED}>
          <span fg={ACCENT}>r</span> restart
        </text>
        <text fg={MUTED}>
          <span fg={ACCENT}>s</span> stop
        </text>
        <text fg={MUTED}>
          <span fg={ACCENT}>f</span> search
        </text>
        <text fg={MUTED}>
          <span fg={ACCENT}>w</span> web
        </text>
        <text fg={MUTED}>
          <span fg={ACCENT}>{"\u23ce"}</span> exit
        </text>
        <text fg={MUTED}>
          <span fg={ACCENT}>q</span> quit
        </text>
      </>
    ) : (
      <text fg={MUTED}>
        <span fg={ACCENT}>^B</span> enter wmux controls
      </text>
    )}
  </box>
);
