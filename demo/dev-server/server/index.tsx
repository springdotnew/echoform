import { devServer } from "../src";

await devServer({
  procs: {
    "counter": {
      command: `bash -c 'i=0; while true; do echo "tick $((i++))"; sleep 1; done'`,
    },
    "logger": {
      command: `bash -c 'while true; do echo "[$(date +%T)] log entry"; sleep 2; done'`,
    },
    "shell": {
      command: process.env.SHELL ?? "/bin/bash",
    },
    "failing": {
      command: `bash -c 'echo "starting..."; sleep 3; echo "crash!"; exit 1'`,
      autoRestart: true,
    },
    "manual": {
      command: `bash -c 'echo "manual process running"; sleep infinity'`,
      autoStart: false,
    },
  },
});
