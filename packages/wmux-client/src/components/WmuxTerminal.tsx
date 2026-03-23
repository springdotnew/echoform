import React, { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import type { InferClientProps } from "@playfast/echoform/client";
import type { WmuxTerminal as WmuxTerminalDef } from "@playfast/wmux/views";
import { toBase64, fromBase64 } from "../utils/base64";
import { THEME } from "../styles/theme";

export function WmuxTerminal(props: InferClientProps<typeof WmuxTerminalDef>): React.ReactElement {
  const { output, id, status } = props;
  const sendInput = props.onInput.mutate;
  const sendResize = props.onResize.mutate;
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const xterm = new XTerm({
      cursorBlink: true,
      screenReaderMode: true,
      fontSize: 14,
      fontFamily: THEME.fontMono,
      theme: {
        background: THEME.bg,
        foreground: THEME.text,
        cursor: THEME.text,
        selectionBackground: "#264f78",
      },
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(containerRef.current);
    fitAddon.fit();
    xtermRef.current = xterm;

    xterm.onData((data: string) => sendInput(toBase64(new TextEncoder().encode(data))));

    xterm.attachCustomKeyEventHandler((event) => {
      if ((event.metaKey || event.ctrlKey) && event.key >= "1" && event.key <= "9") return false;
      if (event.key === "Escape") { event.preventDefault(); return true; }
      return true;
    });

    const ro = new ResizeObserver(() => {
      fitAddon.fit();
      sendResize({ cols: xterm.cols, rows: xterm.rows });
    });
    ro.observe(containerRef.current);
    sendResize({ cols: xterm.cols, rows: xterm.rows });

    return () => {
      ro.disconnect();
      xterm.dispose();
      xtermRef.current = null;
    };
  }, []);

  useEffect(() => {
    return output.subscribe((b64: string) => {
      xtermRef.current?.write(fromBase64(b64));
    });
  }, [output]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} data-testid={`terminal-${id}`} />
      {status !== "running" && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0,
          padding: "4px 12px",
          background: status === "failed" ? "rgba(229,83,75,0.12)" : "rgba(255,255,255,0.04)",
          color: status === "failed" ? THEME.error : "#555",
          fontSize: 12, fontFamily: THEME.fontFamily,
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}>
          {status === "idle" && "Process not started"}
          {status === "stopped" && "Process exited"}
          {status === "failed" && "Process failed"}
        </div>
      )}
    </div>
  );
}
