import React, { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { Play } from "lucide-react";
import "@xterm/xterm/css/xterm.css";
import { toBase64, fromBase64 } from "../utils/base64";

interface WmuxTerminalProps {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly description?: string;
  readonly output: { readonly subscribe: (listener: (chunk: string) => void) => () => void };
  readonly onInput: { readonly mutate: (data: string) => void };
  readonly onResize: { readonly mutate: (size: { cols: number; rows: number }) => void };
  readonly onStart?: () => void;
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
        background: "#1c1c1e",
        foreground: "#f5f5f7",
        cursor: "#f5f5f7",
        cursorAccent: "#1c1c1e",
        selectionBackground: "#48484a80",
        black: "#1c1c1e",
        brightBlack: "#48484a",
        white: "#f5f5f7",
        brightWhite: "#ffffff",
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
      if ((event.metaKey || event.ctrlKey) && (event.key === "[" || event.key === "]" || event.key === "{" || event.key === "}")) return false;
      if ((event.metaKey || event.ctrlKey) && event.key === "k") return false;
      if ((event.metaKey || event.ctrlKey) && event.key === "t") return false;
      if ((event.metaKey || event.ctrlKey) && event.key === "p") return false;
      if ((event.metaKey || event.ctrlKey) && event.key === "w") return false;
      if (event.ctrlKey && event.key === "Tab") return false;
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
      {status === "idle" && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/90 z-10">
          <div className="flex flex-col items-center gap-3 max-w-[320px]">
            {props.description && (
              <code className="text-[11px] text-muted-foreground/60 font-mono bg-card/80 px-3 py-1.5 rounded border border-border/30 max-w-full truncate">
                {props.description}
              </code>
            )}
            {props.onStart && (
              <button
                onClick={props.onStart}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-card border border-border/40 text-foreground/80 hover:text-foreground hover:border-border text-xs cursor-pointer transition-colors"
              >
                <Play size={10} />
                Start
              </button>
            )}
            {!props.onStart && (
              <span className="text-[11px] text-muted-foreground/40">Process not started</span>
            )}
          </div>
        </div>
      )}
      {(status === "stopped" || status === "failed") && (
        <div className={`absolute top-0 left-0 right-0 px-3 py-1 text-xs font-sans border-b border-border ${
          status === "failed"
            ? "bg-destructive/10 text-destructive"
            : "bg-secondary/30 text-muted-foreground"
        }`}>
          {status === "stopped" && "Process exited"}
          {status === "failed" && "Process failed"}
        </div>
      )}
    </div>
  );
}
