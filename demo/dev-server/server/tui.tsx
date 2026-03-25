import { wmux } from "@playfast/wmux";
import { renderWmuxTUI } from "@playfast/wmux-client-terminal";

const handle = await wmux({
  title: "echoform",
  description: "local",
  sidebarItems: [
    {
      category: "background",
      icon: "Activity",
      tabs: [
        { name: "counter", icon: "Clock", process: { command: `bash -c 'i=0; while true; do echo "tick $((i++))"; sleep 1; done'` } },
        { name: "logger", icon: "FileText", process: { command: `bash -c 'while true; do echo "[$(date +%T)] log entry"; sleep 2; done'` } },
      ],
    },
    {
      category: "interactive",
      icon: "Terminal",
      tabs: [
        { name: "shell", icon: "SquareTerminal", process: { command: process.env.SHELL ?? "/bin/bash" } },
      ],
    },
    {
      category: "services",
      icon: "Server",
      tabs: [
        { name: "failing", icon: "Bug", description: "auto-restarts", process: { command: `bash -c 'echo "starting..."; sleep 3; echo "crash!"; exit 1'`, autoRestart: true } },
        { name: "manual", icon: "Wrench", description: "manual start", process: { command: `bash -c 'echo "manual process running"; sleep infinity'`, autoStart: false } },
        { name: "example.com", icon: "Globe", description: "iframe preview", url: "https://example.com" },
      ],
    },
    {
      category: "project",
      icon: "Folder",
      files: ".",
    },
  ],
  port: 4220,
  token: "test-token",
  open: false,
});

await renderWmuxTUI({
  token: handle.token,
  wsUrl: handle.wsUrl,
  webUrl: handle.url,
});
