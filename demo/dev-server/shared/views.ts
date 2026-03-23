import { view, callback, stream, createViews } from "@playfast/echoform";
import { z } from "zod";

const processStatus = z.enum(["idle", "running", "stopped", "failed"]);

const processInfo = z.object({
  id: z.string(),
  name: z.string(),
  status: processStatus,
});

export const DevServerApp = view("DevServerApp", {
  input: {
    processes: z.array(processInfo),
    activeProcessId: z.string(),
  },
  callbacks: {
    onSelectProcess: callback({ input: z.string() }),
    onStartProcess: callback({ input: z.string() }),
    onStopProcess: callback({ input: z.string() }),
    onRestartProcess: callback({ input: z.string() }),
  },
});

export const ProcessTerminal = view("ProcessTerminal", {
  input: {
    id: z.string(),
    name: z.string(),
    status: processStatus,
  },
  callbacks: {
    onInput: callback({ input: z.string() }),
    onResize: callback({ input: z.object({ cols: z.number(), rows: z.number() }) }),
  },
  streams: {
    output: stream(z.string()),
  },
});

export const views = createViews({ DevServerApp, ProcessTerminal });
