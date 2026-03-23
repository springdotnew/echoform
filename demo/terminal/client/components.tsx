import React, { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import type { InferClientProps } from "@react-fullstack/fullstack/client";
import type { Terminal as TerminalDef } from "../shared/views";

// Base64 helpers — matches server encoding
function toBase64(data: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]!);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function Terminal(props: InferClientProps<typeof TerminalDef>): React.ReactElement {
  const { title, output, onInput, onResize } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
      theme: {
        background: "#1e1e1e",
        foreground: "#d4d4d4",
        cursor: "#d4d4d4",
      },
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(containerRef.current);
    fitAddon.fit();
    xtermRef.current = xterm;

    // Keystrokes → base64 encode → send to server PTY
    xterm.onData((data: string) => {
      onInput.mutate(toBase64(new TextEncoder().encode(data)));
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      const { cols, rows } = xterm;
      onResize.mutate({ cols, rows });
    });
    resizeObserver.observe(containerRef.current);

    // Send initial size
    onResize.mutate({ cols: xterm.cols, rows: xterm.rows });

    return () => {
      resizeObserver.disconnect();
      xterm.dispose();
      xtermRef.current = null;
    };
  }, []);

  // Subscribe to PTY output stream
  useEffect(() => {
    return output.subscribe((b64Chunk: string) => {
      // Decode base64 → raw bytes → write to xterm
      xtermRef.current?.write(fromBase64(b64Chunk));
    });
  }, [output]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#1e1e1e" }}>
      <div style={{
        padding: "6px 16px",
        background: "#252526",
        borderBottom: "1px solid #3c3c3c",
        fontSize: "13px",
        color: "#888",
      }}>
        {title}
      </div>
      <div ref={containerRef} style={{ flex: 1 }} data-testid="terminal-output" />
    </div>
  );
}
