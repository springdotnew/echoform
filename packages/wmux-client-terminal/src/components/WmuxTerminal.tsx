/** @jsxImportSource @opentui/react */
import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { fromBase64, toBase64 } from "../utils/base64";
import { getOrCreateBuffer, type StyledLine, type StyledSegment } from "../utils/ansi";
import { usePrefixContext } from "./FocusContext";

const SIDEBAR_WIDTH = 30;

interface WmuxTerminalProps {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly output: { readonly subscribe: (listener: (chunk: string) => void) => () => void };
  readonly onInput: { readonly mutate: (data: string) => void };
  readonly onResize: { readonly mutate: (size: { cols: number; rows: number }) => void };
  readonly children?: ReactNode;
}

const renderSegment = (seg: StyledSegment, key: number): ReactNode => {
  const needsWrap = seg.fg !== undefined || seg.bg !== undefined || seg.bold || seg.italic || seg.underline;
  if (!needsWrap) return <span key={key}>{seg.text}</span>;

  const inner = seg.bold
    ? <strong>{seg.text}</strong>
    : seg.italic
      ? <em>{seg.text}</em>
      : seg.underline
        ? <u>{seg.text}</u>
        : seg.text;

  return <span key={key} fg={seg.fg} bg={seg.bg}>{inner}</span>;
};

const renderLine = (line: StyledLine, key: number, selectable?: boolean): ReactNode => (
  <text key={key} selectable={selectable}>
    {line.segments.length === 0
      ? " "
      : line.segments.map((seg, j) => renderSegment(seg, j))}
  </text>
);

export const WmuxTerminal = (props: WmuxTerminalProps): ReactNode => {
  const { id, output, status } = props;
  const sendInput = props.onInput.mutate;
  const sendResize = props.onResize.mutate;
  const { prefixRef, searchOpenRef, hasSelectionRef, activeTabId } = usePrefixContext();

  const [lines, setLines] = useState<readonly StyledLine[]>([]);
  const { width, height } = useTerminalDimensions();
  const sentResizeRef = useRef<string>("");

  const getTerminalBuffer = useCallback(() => {
    const cols = Math.max(10, width - SIDEBAR_WIDTH - 2);
    return getOrCreateBuffer(id, cols);
  }, [width, id]);

  const isActiveTerminal = activeTabId === id && status === "running";

  // All keys go to PTY unless prefix is active or Ctrl+B (consumed by WmuxApp)
  useKeyboard((key) => {
    if (!isActiveTerminal) return;
    if (key.ctrl && key.name === "b") return; // prefix key, handled by WmuxApp
    if (prefixRef.current) return;            // control mode active, handled by WmuxApp
    if (searchOpenRef.current) return;        // search overlay is open
    if (hasSelectionRef.current && key.name === "c" && !key.ctrl) return; // selection copy, handled by WmuxApp

    const data = key.sequence;
    if (data) {
      sendInput(toBase64(new TextEncoder().encode(data)));
    }
  });

  const handleOutput = useCallback((b64: string) => {
    const bytes = fromBase64(b64);
    const text = new TextDecoder().decode(bytes);
    const buf = getTerminalBuffer();
    buf.write(text);
    setLines(buf.getLines());
  }, [getTerminalBuffer]);

  useEffect(() => {
    return output.subscribe(handleOutput);
  }, [output, handleOutput]);

  useEffect(() => {
    const contentWidth = Math.max(10, width - SIDEBAR_WIDTH - 2);
    const contentHeight = Math.max(5, height - 4);
    const key = `${contentWidth}x${contentHeight}`;
    if (key === sentResizeRef.current) return;
    sentResizeRef.current = key;

    const buf = getTerminalBuffer();
    buf.resize(contentWidth, contentHeight);
    sendResize({ cols: contentWidth, rows: contentHeight });
  }, [width, height, sendResize, getTerminalBuffer]);

  // Component stays mounted for state persistence — return null when not visible
  if (activeTabId !== id) return null;

  if (status === "idle") {
    return (
      <box flexGrow={1} justifyContent="center" alignItems="center" flexDirection="column" gap={1}>
        <text fg="#636366">Process not started</text>
        <text fg="#98989d">Press ^B then Enter to start</text>
      </box>
    );
  }

  return (
    <box flexGrow={1} flexDirection="column">
      {(status === "stopped" || status === "failed") ? (
        <box height={1} paddingX={1} backgroundColor={status === "failed" ? "#3a1111" : "#2c2c2e"}>
          <text fg={status === "failed" ? "#ff453a" : "#8e8e93"}>
            {status === "stopped" ? "Process exited" : "Process failed"}
          </text>
        </box>
      ) : null}
      <scrollbox flexGrow={1} stickyScroll stickyStart="bottom">
        {lines.map((line, i) => renderLine(line, i, true))}
      </scrollbox>
    </box>
  );
};
