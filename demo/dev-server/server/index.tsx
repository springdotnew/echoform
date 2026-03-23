import { wmux } from "@playfast/wmux";

await wmux({
  processes: {
    counter: {
      config: {
        command: `bash -c 'i=0; while true; do echo "tick $((i++))"; sleep 1; done'`,
      },
      category: "background",
    },
    logger: {
      config: {
        command: `bash -c 'while true; do echo "[$(date +%T)] log entry"; sleep 2; done'`,
      },
      category: "background",
    },
    shell: {
      config: {
        command: process.env.SHELL ?? "/bin/bash",
      },
      category: "interactive",
    },
    failing: {
      config: {
        command: `bash -c 'echo "starting..."; sleep 3; echo "crash!"; exit 1'`,
        autoRestart: true,
      },
      category: "services",
    },
    manual: {
      config: {
        command: `bash -c 'echo "manual process running"; sleep infinity'`,
        autoStart: false,
      },
      category: "services",
    },
  },
  port: 4220,
  layout: { preset: "tabs" },
  clientUrl: "http://localhost:5173",
  token: "test-token",
  open: false,
});
