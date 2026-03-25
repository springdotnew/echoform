import { useContext, useRef } from "react";
import { AppContext } from "./contexts";
import type { ViewDef, StreamDef } from "../shared/view-builder";
import type { StreamEmitter } from "../shared/view-inference";
import { createStreamEmitter } from "../shared/view-inference";
import { createStreamUid } from "../shared/branded.types";
import { randomId } from "../shared/id";
import type { StandardSchemaV1 } from "../shared/standard-schema";

/**
 * Create a StreamEmitter for a server-to-client stream prop.
 *
 * ```ts
 * const output = useStream(TerminalDef, "output");
 * output.emit({ data: "hello" });
 * ```
 */
export function useStream<
  V extends ViewDef,
  K extends keyof V["streams"] & string,
>(
  _viewDef: V,
  _streamName: K,
): StreamEmitter<V["streams"][K] extends StreamDef<infer C> ? StandardSchemaV1.InferInput<C> : never> {
  const app = useContext(AppContext);
  const emitterRef = useRef<ReturnType<typeof createStreamEmitter> | null>(null);

  if (!emitterRef.current) {
    const uid = createStreamUid(randomId());
    emitterRef.current = createStreamEmitter(
      uid,
      (streamUid, chunk) => app?.broadcastStreamChunk(streamUid, chunk),
      (streamUid) => app?.broadcastStreamEnd(streamUid),
    );
  }

  return emitterRef.current as StreamEmitter<V["streams"][K] extends StreamDef<infer C> ? StandardSchemaV1.InferInput<C> : never>;
}
