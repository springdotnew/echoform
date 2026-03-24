import { useEffect, type ReactElement } from "react";
import { useViews, useStream } from "@playfast/echoform/server";
import { views, WmuxTerminal } from "../views";
import type { ManagedProcess } from "../process";
import { isCommandConfig } from "../types";

export function TerminalSession({ proc }: { readonly proc: ManagedProcess }): ReactElement | null {
  const View = useViews(views);
  const output = useStream(WmuxTerminal, "output");

  useEffect(() => {
    proc.attachOutput(output);
    if (isCommandConfig(proc.config) && proc.config.autoStart !== false) {
      proc.start();
    }
    return () => proc.dispose();
  }, []);

  if (!View) return null;

  return (
    <View.WmuxTerminal
      id={proc.id}
      name={proc.name}
      status={proc.status}
      output={output}
      onInput={(b64: string) => proc.write(b64)}
      onResize={({ cols, rows }: { cols: number; rows: number }) => proc.resize(cols, rows)}
    />
  );
}
