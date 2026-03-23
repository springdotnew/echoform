import { view, callback, stream, createViews } from "@playfast/echoform";
import { z } from "zod";

const processInfo = z.object({
  pid: z.number(),
  name: z.string(),
  cpu: z.number(),
  memory: z.number(),
});

export const Dashboard = view("Dashboard", {
  input: {
    hostname: z.string(),
    platform: z.string(),
    uptime: z.number(),
    cpuUsage: z.number(),
    memoryTotal: z.number(),
    memoryUsed: z.number(),
    processCount: z.number(),
  },
});

export const ProcessTable = view("ProcessTable", {
  input: {
    processes: z.array(processInfo),
    sortBy: z.enum(["cpu", "memory", "name", "pid"]),
  },
  callbacks: {
    onKill: callback({ input: z.number() }),
    onSort: callback({ input: z.enum(["cpu", "memory", "name", "pid"]) }),
    onRefresh: callback(),
  },
});

export const LogStream = view("LogStream", {
  input: {
    title: z.string(),
  },
  streams: {
    lines: stream(z.string()),
  },
});

export const views = createViews({ Dashboard, ProcessTable, LogStream });
