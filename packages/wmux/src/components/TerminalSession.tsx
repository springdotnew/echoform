import { useEffect, useCallback, type ReactElement } from "react";
import { useStream } from "@playfast/echoform/server";
import { WmuxTerminal } from "../views";
import type { ManagedProcess } from "../process";
import { isCommandConfig } from "../types";

export function TerminalSession({ proc }: { readonly proc: ManagedProcess }): ReactElement {
  const output = useStream(WmuxTerminal, "output");

  useEffect(() => {
    proc.attachOutput(output);
    if (isCommandConfig(proc.config) && proc.config.autoStart !== false) {
      proc.start();
    }
    return () => proc.dispose();
  }, []);

  const handleInput = useCallback((b64: string) => proc.write(b64), [proc]);
  const handleResize = useCallback(({ cols, rows }: { cols: number; rows: number }) => proc.resize(cols, rows), [proc]);

  return (
    <WmuxTerminal
      id={proc.id}
      name={proc.name}
      status={proc.status}
      output={output}
      onInput={handleInput}
      onResize={handleResize}
    />
  );
}
