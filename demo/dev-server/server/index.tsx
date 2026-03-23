import { wmux } from "@playfast/wmux";

await wmux({
  sidebarItems: [
    {
      category: "background",
      tabs: [
        { name: "counter", process: { command: `bash -c 'i=0; while true; do echo "tick $((i++))"; sleep 1; done'` } },
        { name: "logger", process: { command: `bash -c 'while true; do echo "[$(date +%T)] log entry"; sleep 2; done'` } },
      ],
    },
    {
      category: "interactive",
      tabs: [
        { name: "shell", process: { command: process.env.SHELL ?? "/bin/bash" } },
      ],
    },
    {
      category: "services",
      tabs: [
        { name: "failing", description: "auto-restarts", process: { command: `bash -c 'echo "starting..."; sleep 3; echo "crash!"; exit 1'`, autoRestart: true } },
        { name: "manual", description: "manual start", process: { command: `bash -c 'echo "manual process running"; sleep infinity'`, autoStart: false } },
      ],
    },
  ],
  port: 4220,
  clientUrl: "http://localhost:5173",
  token: "test-token",
  open: false,
});
