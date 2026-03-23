import React, { useEffect, useRef, useState, type ReactNode } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import type { InferClientProps } from "@react-fullstack/fullstack/client";
import type { TerminalApp as TerminalAppDef, Terminal as TerminalDef } from "../shared/views";

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

// ── TerminalApp (sidebar + tab content) ──

export function TerminalApp(props: InferClientProps<typeof TerminalAppDef>): React.ReactElement {
  const { tabs, activeTabId, children } = props;
  const newTab = props.onNewTab.mutate;
  const closeTab = props.onCloseTab.mutate;
  const selectTab = props.onSelectTab.mutate;

  // Ctrl+T to create new tab
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "t") {
        e.preventDefault();
        newTab();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [newTab]);

  // Find which child Terminal matches the active tab
  const childArray = React.Children.toArray(children) as React.ReactElement[];

  return (
    <div style={styles.root}>
      {/* Vertical sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <span style={styles.sidebarTitle}>TERMINALS</span>
          <button onClick={() => newTab()} style={styles.newTabBtn} title="New Terminal (Ctrl+T)">
            +
          </button>
        </div>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => selectTab(tab.id)}
            style={{
              ...styles.tabItem,
              ...(tab.id === activeTabId ? styles.tabItemActive : {}),
            }}
          >
            <span style={styles.tabIcon}>&#xf120;</span>
            <span style={styles.tabLabel}>{tab.title}</span>
            {tabs.length > 1 && (
              <span
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                style={styles.tabClose}
              >
                &times;
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Terminal content area */}
      <div style={styles.content}>
        {childArray.map((child) => {
          const childProps = child.props as { id?: string };
          const isActive = childProps.id === activeTabId;
          return (
            <div
              key={childProps.id}
              style={{ ...styles.terminalPane, display: isActive ? "flex" : "none" }}
            >
              {child}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Terminal (xterm.js instance) ──

export function Terminal(props: InferClientProps<typeof TerminalDef>): React.ReactElement {
  const { output, id } = props;
  const sendInput = props.onInput.mutate;
  const sendResize = props.onResize.mutate;
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'JetBrainsMono Nerd Font Mono', 'CaskaydiaCove Nerd Font', 'FiraCode Nerd Font', monospace",
      theme: {
        background: "#1e1e1e",
        foreground: "#d4d4d4",
        cursor: "#d4d4d4",
        selectionBackground: "#264f78",
      },
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(containerRef.current);
    fitAddon.fit();
    xtermRef.current = xterm;
    fitRef.current = fitAddon;

    xterm.onData((data: string) => {
      sendInput(toBase64(new TextEncoder().encode(data)));
    });

    xterm.attachCustomKeyEventHandler((event) => {
      // Let Ctrl+T bubble to window for new tab
      if ((event.metaKey || event.ctrlKey) && event.key === "t") {
        return false;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        return true;
      }
      return true;
    });

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      sendResize({ cols: xterm.cols, rows: xterm.rows });
    });
    resizeObserver.observe(containerRef.current);

    sendResize({ cols: xterm.cols, rows: xterm.rows });

    return () => {
      resizeObserver.disconnect();
      xterm.dispose();
      xtermRef.current = null;
      fitRef.current = null;
    };
  }, []);

  // Refit when this terminal becomes visible
  useEffect(() => {
    const observer = new MutationObserver(() => {
      if (containerRef.current?.offsetParent !== null) {
        fitRef.current?.fit();
      }
    });
    if (containerRef.current?.parentElement) {
      observer.observe(containerRef.current.parentElement, { attributes: true, attributeFilter: ["style"] });
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return output.subscribe((b64Chunk: string) => {
      xtermRef.current?.write(fromBase64(b64Chunk));
    });
  }, [output]);

  return <div ref={containerRef} style={styles.xtermContainer} data-testid={`terminal-${id}`} />;
}

// ── Styles ──

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    height: "100vh",
    background: "#1e1e1e",
    color: "#d4d4d4",
  },
  sidebar: {
    width: "200px",
    background: "#252526",
    borderRight: "1px solid #3c3c3c",
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
  },
  sidebarHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 12px",
    borderBottom: "1px solid #3c3c3c",
  },
  sidebarTitle: {
    fontSize: "11px",
    fontWeight: 600,
    textTransform: "uppercase",
    color: "#888",
    letterSpacing: "0.5px",
  },
  newTabBtn: {
    background: "none",
    border: "1px solid #555",
    color: "#ccc",
    width: "22px",
    height: "22px",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "14px",
    lineHeight: "1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  tabItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 12px",
    cursor: "pointer",
    fontSize: "13px",
    color: "#aaa",
    borderLeft: "2px solid transparent",
  },
  tabItemActive: {
    background: "#1e1e1e",
    color: "#fff",
    borderLeftColor: "#007acc",
  },
  tabIcon: {
    fontSize: "14px",
    width: "16px",
    textAlign: "center",
  },
  tabLabel: {
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  tabClose: {
    opacity: 0.5,
    cursor: "pointer",
    fontSize: "14px",
    lineHeight: "1",
  },
  content: {
    flex: 1,
    display: "flex",
    overflow: "hidden",
  },
  terminalPane: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  xtermContainer: {
    flex: 1,
  },
};
