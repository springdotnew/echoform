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
    <div className={`font-mono text-[13px] leading-[20px] transition-opacity duration-300 ${dimmed ? "text-muted-foreground/50" : "text-muted-foreground/80"}`}>
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
  return <span className="text-muted-foreground/60 inline-block w-[4ch]">{SPINNER_FRAMES[frame]}</span>;
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

        <span className="text-[11px] text-muted-foreground/40 font-mono">local network access</span>
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
            <span className="text-muted-foreground/50 text-[12px] font-mono">{host}</span>
          )}
        </div>

        <div className="bg-card/50 border border-border/30 rounded-lg px-4 py-3 max-w-[360px]">
          <p className="text-[12px] text-muted-foreground/70 leading-relaxed text-center">{message}</p>
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
          <span className="text-muted-foreground/60 text-[12px]">The dev server closed the connection.</span>
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

/* ── Mock environment background ────────────────────────────── */

const MOCK_CATEGORIES = [
  { name: "services", color: "#3b82f6", icon: "Server", tabs: [
    { name: "api-server", desc: "bun run --watch src/index.ts", status: "running" },
    { name: "worker", desc: "bun run worker.ts", status: "running" },
    { name: "scheduler", desc: "bun run cron.ts", status: "idle" },
  ]},
  { name: "frontend", color: "#8b5cf6", icon: "Globe", tabs: [
    { name: "next-dev", desc: "next dev --turbo", status: "running" },
    { name: "storybook", desc: "storybook dev -p 6006", status: "idle" },
  ]},
  { name: "database", color: "#14b8a6", icon: "Database", tabs: [
    { name: "postgres", desc: "docker compose up db", status: "running" },
    { name: "redis", desc: "redis-server", status: "running" },
  ]},
  { name: "files", color: "#f97316", icon: "Folder", tabs: [] },
] as const;

const MOCK_TERMINAL_LINES = [
  { text: "$ bun run --watch src/index.ts", bright: true },
  { text: "  Loaded .env (14 variables)", bright: false },
  { text: "  Database connected (postgres://localhost:5432/app)", bright: false },
  { text: "  Redis connected (localhost:6379)", bright: false },
  { text: "\x1b[32m✓\x1b[0m Server listening on http://localhost:3000", bright: true },
  { text: "", bright: false },
  { text: "  GET /api/health 200 2ms", bright: false },
  { text: "  GET /api/users 200 14ms", bright: false },
  { text: "  POST /api/auth/login 200 45ms", bright: false },
  { text: "  GET /api/dashboard 200 8ms", bright: false },
  { text: "  WS /api/realtime connected (client #1)", bright: false },
  { text: "  GET /api/users/me 200 3ms", bright: false },
];

function MockStatusDot({ status }: { readonly status: string }): React.ReactElement {
  const color = status === "running" ? "#30d158" : "#636366";
  return <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: color }} />;
}

function MockSidebar(): React.ReactElement {
  return (
    <div className="w-[240px] min-w-[240px] bg-[#232325] border-r border-border/50 flex flex-col select-none h-full">
      <div className="flex-1 py-1.5">
        {MOCK_CATEGORIES.map((cat, ci) => (
          <div key={cat.name} className="mb-1 border-l-[3px]" style={{ borderLeftColor: ci === 0 ? cat.color : `color-mix(in srgb, ${cat.color} 20%, transparent)` }}>
            <div className={`flex items-center gap-2 px-3 py-2.5 text-xs ${ci === 0 ? "text-foreground bg-card/60" : "text-muted-foreground/70"}`}>
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: cat.color, opacity: ci === 0 ? 1 : 0.6 }} />
              <span className="lowercase tracking-wide font-medium text-[12px]">{cat.name}</span>
            </div>
            {ci === 0 && cat.tabs.map((tab) => (
              <div key={tab.name} className={`flex items-center gap-2.5 pl-7 pr-3 py-2 mx-1.5 rounded-md ${tab.name === "api-server" ? "bg-accent/60 text-foreground" : "text-muted-foreground/70"}`}>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] leading-snug truncate">{tab.name}</div>
                  <div className="text-[10px] leading-snug text-muted-foreground/60 truncate mt-0.5">{tab.desc}</div>
                </div>
                <MockStatusDot status={tab.status} />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="border-t border-border/40 px-3 py-2 flex items-center gap-3">
        <span className="text-[10px] text-muted-foreground/50 font-mono">⌘K</span>
        <span className="text-[10px] text-muted-foreground/50 font-mono">↑↓</span>
        <span className="text-[10px] text-muted-foreground/50 font-mono">⌘[]</span>
      </div>
    </div>
  );
}

function MockTopBar(): React.ReactElement {
  return (
    <div className="h-11 shrink-0 flex items-center border-b border-border/50 bg-background px-4 gap-4">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded bg-card border border-border/50 flex items-center justify-center">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" className="text-foreground/80">
            <path d="M2 4L8 1L14 4V12L8 15L2 12V4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        </div>
        <span className="text-[13px] font-semibold text-foreground tracking-tight">my-project</span>
        <span className="text-[11px] text-muted-foreground/70">dev environment</span>
      </div>
      <div className="flex-1 flex justify-center">
        <div className="flex items-center gap-2 px-3 py-1 rounded-lg border border-border/40 bg-card/40 text-muted-foreground/60 max-w-[360px] min-w-[220px] w-full">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <span className="text-[11px]">Search...</span>
        </div>
      </div>
      <div className="w-[100px]" />
    </div>
  );
}

function MockTerminal(): React.ReactElement {
  return (
    <div className="flex-1 min-h-0 bg-background p-4 font-mono text-[13px] leading-[22px] overflow-hidden">
      {MOCK_TERMINAL_LINES.map((line, i) => (
        <div key={i} className={line.bright ? "text-foreground/90" : "text-muted-foreground/60"}>
          {line.text || "\u00A0"}
        </div>
      ))}
      <div className="flex items-center mt-1">
        <span className="text-muted-foreground/60">  GET /api/config 200 5ms</span>
        <span className="inline-block w-[7px] h-[16px] bg-foreground/80 ml-0.5 animate-pulse" />
      </div>
    </div>
  );
}

function MockEnvironment(): React.ReactElement {
  return (
    <div className="absolute inset-0 flex flex-col bg-background text-foreground font-sans">
      <MockTopBar />
      <div className="flex flex-1 min-h-0">
        <MockSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <MockTerminal />
        </div>
      </div>
    </div>
  );
}

/* ── Setup modal ───────────────────────────────────────────── */

function CopyButton({ text }: { readonly text: string }): React.ReactElement {
  const [copied, setCopied] = useState(false);

  const handleCopy = (): void => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-transparent hover:bg-white/10 text-muted-foreground/50 hover:text-foreground/80 transition-colors cursor-pointer opacity-0 group-hover/code:opacity-100"
      title="Copy to clipboard"
    >
      {copied
        ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-success"><path d="M20 6 9 17l-5-5"/></svg>
        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      }
    </button>
  );
}

function CodeBlock({ raw, delay, children }: { readonly raw: string; readonly delay?: number; readonly children: React.ReactNode }): React.ReactElement {
  const [lit, setLit] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLit(true), delay ?? 600);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <pre
      className={`relative bg-[#1c1c1e] border border-border/50 rounded-lg px-4 py-3 pr-10 text-[12px] font-mono leading-relaxed overflow-x-auto group/code transition-all duration-700 ${lit ? "wmux-code-lit" : "wmux-code-dim"}`}
    >
      {children}
      <CopyButton text={raw} />
    </pre>
  );
}

/* Syntax color tokens — hand-tuned for Apple dark */
const K = "wmux-tok-kw";   // keyword (import, await, from)
const S = "wmux-tok-str";  // string
const F = "wmux-tok-fn";   // function / identifier
const P = "wmux-tok-prop"; // property key
const C = "wmux-tok-dim";  // punctuation dim
const N = "wmux-tok-norm"; // normal

function StepNumber({ n }: { readonly n: number }): React.ReactElement {
  return (
    <span className="w-5 h-5 rounded-full bg-[#0a84ff] text-white text-[11px] font-semibold flex items-center justify-center shrink-0">
      {n}
    </span>
  );
}

function SetupModal(): React.ReactElement {
  return (
    <div className="relative w-full max-w-[680px] rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden">
      {/* Title bar */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border/40">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0a84ff] to-[#5e5ce6] flex items-center justify-center shadow-lg">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="text-white">
            <path d="M2 4L8 1L14 4V12L8 15L2 12V4Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            <path d="M2 4L8 7M8 7L14 4M8 7V15" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" opacity="0.5" />
          </svg>
        </div>
        <div>
          <h1 className="text-[16px] font-semibold text-foreground tracking-tight">Welcome to wmux</h1>
          <p className="text-[12px] text-muted-foreground/70 mt-0.5">Web-based terminal multiplexer for dev environments</p>
        </div>
      </div>

      {/* Steps */}
      <div className="px-5 py-5 flex flex-col gap-5">
        <div className="flex gap-3">
          <StepNumber n={1} />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-foreground/90 font-medium mb-2">Install the package</p>
            <CodeBlock raw="bun add @playfast/wmux" delay={700}>
              <span className={`${C} select-none`}>$ </span><span className={N}>bun add</span> <span className={S}>@playfast/wmux</span>
            </CodeBlock>
          </div>
        </div>

        <div className="flex gap-3">
          <StepNumber n={2} />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-foreground/90 font-medium mb-2">Create your config</p>
            <CodeBlock delay={1000} raw={`import { wmux } from "@playfast/wmux";\n\nawait wmux({\n  title: "my-project",\n  sidebarItems: [\n    {\n      category: "services",\n      tabs: [\n        { name: "api", process: { command: "bun run dev" } },\n        { name: "web", process: { command: "next dev" } },\n      ],\n    },\n    {\n      category: "files",\n      files: "./src",\n    },\n  ],\n});`}>
              <span className={K}>import</span> <span className={N}>{"{ "}</span><span className={F}>wmux</span><span className={N}>{" }"}</span> <span className={K}>from</span> <span className={S}>"@playfast/wmux"</span><span className={C}>;</span>{"\n"}
{"\n"}
<span className={K}>await</span> <span className={F}>wmux</span><span className={N}>({"{"}</span>{"\n"}
{"  "}<span className={P}>title</span><span className={C}>:</span> <span className={S}>"my-project"</span><span className={C}>,</span>{"\n"}
{"  "}<span className={P}>sidebarItems</span><span className={C}>:</span> <span className={N}>[</span>{"\n"}
{"    "}<span className={N}>{"{"}</span>{"\n"}
{"      "}<span className={P}>category</span><span className={C}>:</span> <span className={S}>"services"</span><span className={C}>,</span>{"\n"}
{"      "}<span className={P}>tabs</span><span className={C}>:</span> <span className={N}>[</span>{"\n"}
{"        "}<span className={N}>{"{"}</span> <span className={P}>name</span><span className={C}>:</span> <span className={S}>"api"</span><span className={C}>,</span> <span className={P}>process</span><span className={C}>:</span> <span className={N}>{"{"}</span> <span className={P}>command</span><span className={C}>:</span> <span className={S}>"bun run dev"</span> <span className={N}>{"}"}</span> <span className={N}>{"}"}</span><span className={C}>,</span>{"\n"}
{"        "}<span className={N}>{"{"}</span> <span className={P}>name</span><span className={C}>:</span> <span className={S}>"web"</span><span className={C}>,</span> <span className={P}>process</span><span className={C}>:</span> <span className={N}>{"{"}</span> <span className={P}>command</span><span className={C}>:</span> <span className={S}>"next dev"</span> <span className={N}>{"}"}</span> <span className={N}>{"}"}</span><span className={C}>,</span>{"\n"}
{"      "}<span className={N}>]</span><span className={C}>,</span>{"\n"}
{"    "}<span className={N}>{"}"}</span><span className={C}>,</span>{"\n"}
{"    "}<span className={N}>{"{"}</span>{"\n"}
{"      "}<span className={P}>category</span><span className={C}>:</span> <span className={S}>"files"</span><span className={C}>,</span>{"\n"}
{"      "}<span className={P}>files</span><span className={C}>:</span> <span className={S}>"./src"</span><span className={C}>,</span>{"\n"}
{"    "}<span className={N}>{"}"}</span><span className={C}>,</span>{"\n"}
{"  "}<span className={N}>]</span><span className={C}>,</span>{"\n"}
<span className={N}>{"}"}</span><span className={N}>)</span><span className={C}>;</span>
            </CodeBlock>
          </div>
        </div>

        <div className="flex gap-3">
          <StepNumber n={3} />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-foreground/90 font-medium mb-2">Run it</p>
            <CodeBlock raw="bun run wmux.ts" delay={1300}>
              <span className={`${C} select-none`}>$ </span><span className={N}>bun run</span> <span className={S}>wmux.ts</span>
            </CodeBlock>
            <p className="text-[11px] text-muted-foreground/60 mt-2 leading-relaxed">
              The browser will open automatically with your multiplexed dev environment.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-border/40 flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground/50">
          Or pass <code className="text-muted-foreground/70 bg-background/60 px-1.5 py-0.5 rounded text-[10px] font-mono">#token=...&ws=...</code> in the URL
        </span>
        <div className="flex items-center gap-3">
          <a
            href="https://www.npmjs.com/package/@playfast/wmux"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-muted-foreground/60 hover:text-foreground/80 transition-colors"
          >
            npm ↗
          </a>
          <span className="text-border">·</span>
          <a
            href="https://github.com/springdotnew/echoform"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-[#0a84ff] hover:text-[#409cff] transition-colors"
          >
            Docs ↗
          </a>
        </div>
      </div>
    </div>
  );
}

function NoParamsScreen(): React.ReactElement {
  return (
    <div className="relative h-screen w-screen bg-background font-sans overflow-hidden">
      {/* Mocked environment background */}
      <MockEnvironment />

      {/* Blur overlay — light enough to keep the mock UI visible */}
      <div className="absolute inset-0 bg-background/40 backdrop-blur-md wmux-blur-enter" />

      {/* Setup modal */}
      <div className="absolute inset-0 flex items-center justify-center p-6 z-10">
        <div className="wmux-modal-enter w-full max-w-[680px]">
          <SetupModal />
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
