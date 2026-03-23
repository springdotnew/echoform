import { view, callback, stream, createViews } from "@react-fullstack/fullstack";
import { z } from "zod";

export const Terminal = view("Terminal", {
  input: { title: z.string() },
  callbacks: {
    onInput: callback({ input: z.string() }),
  },
  streams: {
    output: stream(z.string()),
  },
});

export const views = createViews({ Terminal });
