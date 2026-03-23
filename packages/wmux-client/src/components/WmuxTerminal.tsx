import React, { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { toBase64, fromBase64 } from "../utils/base64";

interface WmuxTerminalProps {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly output: { readonly subscribe: (listener: (chunk: string) => void) => () => void };
  readonly onInput: { readonly mutate: (data: string) => void };
  readonly onResize: { readonly mutate: (size: { cols: number; rows: number }) => void };
  readonly children?: React.ReactNode;
}

export function WmuxTerminal(props: WmuxTerminalProps): React.ReactElement {
  const { output, id, status } = props;
  const sendInput = props.onInput.mutate;
  const sendResize = props.onResize.mutate;
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'JetBrainsMono Nerd Font Mono', 'Geist Mono', ui-monospace, SFMono-Regular, monospace",
      theme: {
        background: "#030304",
        foreground: "#fafafa",
        cursor: "#fafafa",
        selectionBackground: "oklch(0.7 0.1 285 / 20%)",
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
      if ((event.metaKey || event.ctrlKey) && (event.key === "[" || event.key === "]")) return false;
      if ((event.metaKey || event.ctrlKey) && event.key === "k") return false;
      if (event.key === "Escape") { event.preventDefault(); return true; }
      return true;
    });

    // Track last sent dimensions to avoid redundant resizes (shell redraws prompt on SIGWINCH)
    let lastCols = xterm.cols;
    let lastRows = xterm.rows;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    const doResize = (): void => {
      fitAddon.fit();
      if (xterm.cols !== lastCols || xterm.rows !== lastRows) {
        lastCols = xterm.cols;
        lastRows = xterm.rows;
        sendResize({ cols: xterm.cols, rows: xterm.rows });
      }
    };

    const ro = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(doResize, 100);
    });
    ro.observe(containerRef.current);
    sendResize({ cols: xterm.cols, rows: xterm.rows });

    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
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
    <div className="w-full h-full relative">
      <div ref={containerRef} className="w-full h-full" data-testid={`terminal-${id}`} />
      {status !== "running" && (
        <div className={`absolute top-0 left-0 right-0 px-3 py-1 text-xs font-sans border-b border-border ${
          status === "failed"
            ? "bg-destructive/10 text-destructive"
            : "bg-secondary/30 text-muted-foreground"
        }`}>
          {status === "idle" && "Process not started"}
          {status === "stopped" && "Process exited"}
          {status === "failed" && "Process failed"}
        </div>
      )}
    </div>
  );
}
