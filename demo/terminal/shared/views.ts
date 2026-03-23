import { view, callback, stream, createViews } from "@react-fullstack/fullstack";
import { z } from "zod";

export const Terminal = view("Terminal", {
  input: {
    title: z.string(),
  },
  callbacks: {
    /** Raw terminal input (keystrokes as base64-encoded bytes) */
    onInput: callback({ input: z.string() }),
    /** Terminal resize event */
    onResize: callback({ input: z.object({ cols: z.number(), rows: z.number() }) }),
  },
  streams: {
    /** Raw PTY output (VT escape sequences + text, base64-encoded) */
    output: stream(z.string()),
  },
});

export const views = createViews({ Terminal });
