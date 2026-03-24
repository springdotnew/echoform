import "./index.css";
import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Client } from "@playfast/echoform/client";
import { parseHashParams } from "./utils/params";
import { useAuthenticatedTransport } from "./utils/transport";
import { WmuxApp } from "./components/WmuxApp";
import { WmuxTerminal } from "./components/WmuxTerminal";
import { WmuxFileContent } from "./components/WmuxFileContent";
import { WmuxIframe } from "./components/WmuxIframe";

const viewComponents = {
  WmuxApp,
  WmuxTerminal,
  WmuxFileContent,
  WmuxIframe,
};

function TerminalLine({ text, delay, dimmed }: { readonly text: string; readonly delay: number; readonly dimmed?: boolean }): React.ReactElement {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  if (!visible) return <div className="h-[20px]" />;
  return (
    <div className={`font-mono text-[13px] leading-[20px] transition-opacity duration-300 ${dimmed ? "text-muted-foreground/30" : "text-muted-foreground/70"}`}>
      {text}
    </div>
  );
}

const SPINNER_FRAMES = ["    ", ".   ", "..  ", "... ", "...."];

function Spinner(): React.ReactElement {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setFrame((f) => (f + 1) % SPINNER_FRAMES.length), 400);
    return () => clearInterval(t);
  }, []);
  return <span className="text-muted-foreground/40 inline-block w-[4ch]">{SPINNER_FRAMES[frame]}</span>;
}

function extractHost(url: string): string {
  try { return new URL(url).host; } catch { return url; }
}

function ConnectingScreen({ wsUrl }: { readonly wsUrl: string }): React.ReactElement {
  const host = extractHost(wsUrl);

  return (
    <div className="flex items-center justify-center h-screen w-screen bg-background font-sans">
      <div className="flex flex-col items-center gap-6 wmux-fade-in">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-card border border-border/40 flex items-center justify-center wmux-pulse-border">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-foreground/80">
              <path d="M2 4L8 1L14 4V12L8 15L2 12V4Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
              <path d="M2 4L8 7M8 7L14 4M8 7V15" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" opacity="0.4" />
            </svg>
          </div>
          <span className="text-foreground/90 text-[15px] font-medium tracking-tight">wmux</span>
        </div>

        <div className="bg-card/50 border border-border/30 rounded-lg px-5 py-4 w-[340px] overflow-hidden">
          <TerminalLine text={`$ connecting to ${host}`} delay={0} />
          <TerminalLine text="  resolving endpoint..." delay={300} dimmed />
          <TerminalLine text="  establishing websocket..." delay={800} dimmed />
          <div className="font-mono text-[13px] leading-[20px] text-success/70 mt-1 flex items-center gap-1">
            <Spinner />
          </div>
        </div>

        <span className="text-[11px] text-muted-foreground/20 font-mono">local network access</span>
      </div>
    </div>
  );
}

function ErrorScreen({ message, wsUrl, onRetry }: {
  readonly message: string;
  readonly wsUrl?: string;
  readonly onRetry?: () => void;
}): React.ReactElement {
  const host = wsUrl ? extractHost(wsUrl) : null;

  return (
    <div className="flex items-center justify-center h-screen w-screen bg-background font-sans">
      <div className="flex flex-col items-center gap-5 wmux-fade-in">
        <div className="w-10 h-10 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="text-destructive">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M8 5V8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="8" cy="11" r="0.75" fill="currentColor" />
          </svg>
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <span className="text-foreground/80 text-[14px] font-medium">Connection failed</span>
          {host && (
            <span className="text-muted-foreground/30 text-[12px] font-mono">{host}</span>
          )}
        </div>

        <div className="bg-card/50 border border-border/30 rounded-lg px-4 py-3 max-w-[360px]">
          <p className="text-[12px] text-muted-foreground/50 leading-relaxed text-center">{message}</p>
        </div>

        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-1.5 rounded-md bg-card border border-border/40 text-[12px] text-foreground/70 hover:text-foreground hover:border-border/60 cursor-pointer transition-colors font-sans"
          >
            Retry connection
          </button>
        )}
      </div>
    </div>
  );
}

function DisconnectedScreen({ wsUrl }: { readonly wsUrl?: string }): React.ReactElement {
  return (
    <div className="flex items-center justify-center h-screen w-screen bg-background font-sans">
      <div className="flex flex-col items-center gap-5 wmux-fade-in">
        <div className="w-10 h-10 rounded-xl bg-warning/10 border border-warning/20 flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="text-warning">
            <path d="M8 2L14.5 13H1.5L8 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M8 6.5V9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
          </svg>
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <span className="text-foreground/80 text-[14px] font-medium">Server disconnected</span>
          <span className="text-muted-foreground/30 text-[12px]">The dev server closed the connection.</span>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="px-4 py-1.5 rounded-md bg-card border border-border/40 text-[12px] text-foreground/70 hover:text-foreground hover:border-border/60 cursor-pointer transition-colors font-sans"
        >
          Reconnect
        </button>
      </div>
    </div>
  );
}

function NoParamsScreen(): React.ReactElement {
  return (
    <div className="flex items-center justify-center h-screen w-screen bg-background font-sans">
      <div className="flex flex-col items-center gap-5 wmux-fade-in">
        <div className="w-10 h-10 rounded-xl bg-card border border-border/40 flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="text-muted-foreground/50">
            <path d="M2 4L8 1L14 4V12L8 15L2 12V4Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M2 4L8 7M8 7L14 4M8 7V15" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" opacity="0.4" />
          </svg>
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <span className="text-foreground/80 text-[14px] font-medium">wmux</span>
          <span className="text-muted-foreground/30 text-[12px]">No connection parameters provided.</span>
        </div>

        <div className="bg-card/50 border border-border/30 rounded-lg px-4 py-3 max-w-[380px]">
          <p className="text-[12px] text-muted-foreground/40 leading-relaxed text-center">
            Start a wmux dev server and open the URL it provides, or pass <code className="text-muted-foreground/60 bg-background/50 px-1 py-px rounded text-[11px]">#token=...&ws=...</code> in the URL hash.
          </p>
        </div>
      </div>
    </div>
  );
}

function App(): React.ReactElement {
  const params = parseHashParams();

  if (!params) {
    return <NoParamsScreen />;
  }

  const { transport, error, status } = useAuthenticatedTransport(params.wsUrl, params.token);

  if (status === "disconnected") {
    return <DisconnectedScreen wsUrl={params.wsUrl} />;
  }

  if (error) {
    return (
      <ErrorScreen
        message={error}
        wsUrl={params.wsUrl}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (!transport) {
    return <ConnectingScreen wsUrl={params.wsUrl} />;
  }

  return <Client transport={transport} views={viewComponents} requestViewTreeOnMount />;
}

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
