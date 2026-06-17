import { wmux } from "@playfast/wmux";
import { createExposedApiTerminal } from "./exposed-api";

const exposedApiTerminal = createExposedApiTerminal();

await wmux({
  title: "echoform",
  description: "local",
  sidebarItems: [
    {
      category: "background",
      icon: "Activity",
      tabs: [
        { name: "counter", icon: "Clock", command: `bash -c 'i=0; while true; do echo "tick $((i++))"; sleep 1; done'` },
        { name: "logger", icon: "FileText", command: `bash -c 'while true; do echo "[$(date +%T)] log entry"; sleep 2; done'` },
      ],
    },
    {
      category: "interactive",
      icon: "Terminal",
      tabs: [
        { name: "shell", icon: "SquareTerminal", command: process.env.SHELL ?? "/bin/bash" },
      ],
    },
    {
      category: "services",
      icon: "Server",
      tabs: [
        { name: "failing", icon: "Bug", description: "auto-restarts", command: `bash -c 'echo "starting..."; sleep 3; echo "crash!"; exit 1'`, autoRestart: true },
        { name: "manual", icon: "Wrench", description: "manual start", command: `bash -c 'echo "manual process running"; sleep infinity'`, autoStart: false },
        { name: "example.com", icon: "Globe", description: "iframe preview", url: "https://example.com" },
      ],
    },
    {
      category: "exposed api",
      icon: "Workflow",
      tabs: [
        { name: "bridge", icon: "Zap", description: "TerminalBridgeHandle.onRestart", terminal: exposedApiTerminal.handle },
      ],
    },
    {
      category: "project",
      icon: "Folder",
      files: ".",
    },
  ],
  port: 4220,
  clientUrl: "http://localhost:5173",
  token: "test-token",
  open: false,
});
