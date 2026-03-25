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
 * If the stream was defined with `{ replay: N }`, the emitter automatically
 * buffers the last N chunks and replays them to newly connected clients.
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
    const streamDef = _viewDef.streams[_streamName] as StreamDef | undefined;
    const replaySize = streamDef?.replay;
    const emitter = createStreamEmitter(
      uid,
      (streamUid, chunk) => app?.broadcastStreamChunk(streamUid, chunk),
      (streamUid) => app?.broadcastStreamEnd(streamUid),
      replaySize,
    );
    emitterRef.current = emitter;

    if (replaySize !== undefined && replaySize > 0) {
      app?.registerStreamBuffer(uid, emitter.getBuffer);
    }
  }

  return emitterRef.current as StreamEmitter<V["streams"][K] extends StreamDef<infer C> ? StandardSchemaV1.InferInput<C> : never>;
}
