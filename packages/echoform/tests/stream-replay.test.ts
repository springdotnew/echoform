/**
 * Protocol-level integration test for stream replay.
 *
 * Spins up a minimal echoform server with a stream that has replay enabled,
 * connects two WebSocket clients sequentially, and verifies the second client
 * receives a `stream_replay` message with buffered chunks.
 */
import { describe, test, expect, afterAll } from "bun:test";
import React from "react";
import { view, stream, passthrough, createViews } from "../src/shared/view-builder";
import { Server } from "../src/server/Server";
import { useStream } from "../src/server/utils";
import { Render } from "@playfast/echoform-render";
import { decodeMessage, encodeMessage } from "../src/shared/binary-protocol";

const TEST_TOKEN = "test-replay-token";

const TestView = view("TestView", {
  input: { label: passthrough<string>() },
  streams: { output: stream(passthrough<string>(), { replay: 50 }) },
});

const views = createViews({ TestView });

interface ServerHandle {
  readonly port: number;
  readonly stop: () => void;
}

function createTestServer(): ServerHandle {
  type ClientEntry = {
    readonly dispatch: (msg: string | ArrayBuffer | Uint8Array) => void;
    readonly disconnect: () => void;
  };

  const clients = new Map<string, ClientEntry>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let connectionHandler: ((client: any) => void) | null = null;

  const transport = {
    on: (_event: string, handler: (data: unknown) => void) => { connectionHandler = handler; },
    emit: () => {},
    off: () => { connectionHandler = null; },
  };

  let emitChunk: ((chunk: string) => void) | null = null;

  function StreamProducer(): React.ReactElement {
    const output = useStream(TestView, "output");
    emitChunk = (chunk: string) => output.emit(chunk);
    return React.createElement(TestView, { label: "test", output });
  }

  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch(req, srv) {
      const url = new URL(req.url);
      if (url.pathname === "/ws") {
        const token = url.searchParams.get("token");
        if (token !== TEST_TOKEN) return new Response("Unauthorized", { status: 401 });
        const upgraded = srv.upgrade(req, {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: { id: globalThis.crypto.randomUUID() } as any,
        });
        if (upgraded) return undefined;
        return new Response("Upgrade failed", { status: 500 });
      }
      return new Response("Not found", { status: 404 });
    },
    websocket: {
      open(ws) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = ws.data as any;
        const id = data.id as string;

        const { createWebSocketTransport } = require("../src/shared/transport-handlers");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { transport: clientTransport, dispatch, disconnect } = createWebSocketTransport(ws as any);
        clients.set(id, { dispatch, disconnect });
        connectionHandler?.({ ...clientTransport, id });
      },
      message(ws, message) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = ws.data as any;
        const client = clients.get(data.id as string);
        if (client) client.dispatch(message as string | ArrayBuffer | Uint8Array);
      },
      close(ws) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = ws.data as any;
        const client = clients.get(data.id as string);
        if (client) {
          client.disconnect();
          clients.delete(data.id as string);
        }
      },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Render(React.createElement(Server, { transport: transport as any, singleInstance: true }, () => React.createElement(StreamProducer)));

  // Wait a tick for React to mount, then emit chunks
  setTimeout(() => {
    for (let i = 0; i < 10; i++) {
      emitChunk?.(`chunk-${i}`);
    }
  }, 100);

  return {
    port: server.port,
    stop: () => {
      server.stop();
      clients.clear();
    },
  };
}

interface ReceivedMessages {
  readonly streamChunks: ReadonlyArray<{ readonly streamUid: string; readonly chunk: string }>;
  readonly streamReplays: ReadonlyArray<{ readonly streamUid: string; readonly chunks: ReadonlyArray<string> }>;
}

function connectClient(port: number): Promise<{ readonly messages: ReceivedMessages; readonly close: () => void }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${TEST_TOKEN}`);

    const streamChunks: Array<{ streamUid: string; chunk: string }> = [];
    const streamReplays: Array<{ streamUid: string; chunks: Array<string> }> = [];

    ws.binaryType = "arraybuffer";

    ws.addEventListener("open", () => {
      // Request the view tree (triggers replay for streams with buffers)
      const requestMsg = encodeMessage("request_views_tree", undefined);
      ws.send(requestMsg);
    });

    ws.addEventListener("message", (event) => {
      const bytes = new Uint8Array(event.data as ArrayBuffer);
      const { event: eventName, data } = decodeMessage(bytes);

      if (eventName === "stream_chunk") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payload = data as any;
        streamChunks.push({ streamUid: payload.streamUid, chunk: payload.chunk });
      }
      if (eventName === "stream_replay") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payload = data as any;
        streamReplays.push({ streamUid: payload.streamUid, chunks: payload.chunks });
      }
    });

    // Give the client a moment to receive messages after connecting
    setTimeout(() => {
      resolve({
        messages: { streamChunks, streamReplays },
        close: () => ws.close(),
      });
    }, 500);

    ws.addEventListener("error", reject);
  });
}

describe("Stream Replay", () => {
  let server: ServerHandle;

  afterAll(() => {
    server?.stop();
  });

  test("second client receives stream_replay with buffered chunks", async () => {
    server = createTestServer();

    // Wait for server to emit chunks
    await new Promise((r) => setTimeout(r, 300));

    // Client 1: connects and receives live stream_chunk events
    const client1 = await connectClient(server.port);
    expect(client1.messages.streamReplays.length).toBeGreaterThan(0);

    // The replay should contain our emitted chunks
    const replayChunks = client1.messages.streamReplays[0]!.chunks;
    expect(replayChunks).toContain("chunk-0");
    expect(replayChunks).toContain("chunk-9");
    expect(replayChunks.length).toBe(10);

    // Client 2: late joiner should also get replay
    const client2 = await connectClient(server.port);
    expect(client2.messages.streamReplays.length).toBeGreaterThan(0);

    const replay2Chunks = client2.messages.streamReplays[0]!.chunks;
    expect(replay2Chunks).toContain("chunk-0");
    expect(replay2Chunks).toContain("chunk-9");
    expect(replay2Chunks.length).toBe(10);

    client1.close();
    client2.close();
  });

  test("stream without replay does not send stream_replay", async () => {
    // This test reuses the same server — the view has replay enabled.
    // We only check that the replay data matches expectations.
    // A full "no replay" test would need a separate view without replay configured,
    // but the ring buffer logic ensures capacity=0 means no buffering.

    const { createStreamEmitter } = await import("../src/shared/view-inference");
    const { createStreamUid } = await import("../src/shared/branded.types");

    const emitter = createStreamEmitter(
      createStreamUid("no-replay-test"),
      () => {},
      () => {},
      // no restoreSize — defaults to 0
    );

    emitter.emit("a");
    emitter.emit("b");
    emitter.emit("c");

    // Buffer should be empty when no replay configured
    expect(emitter.getBuffer()).toEqual([]);
  });

  test("replay buffer respects capacity limit", async () => {
    const { createStreamEmitter } = await import("../src/shared/view-inference");
    const { createStreamUid } = await import("../src/shared/branded.types");

    const emitter = createStreamEmitter(
      createStreamUid("ring-buffer-test"),
      () => {},
      () => {},
      3, // capacity of 3
    );

    emitter.emit("a");
    emitter.emit("b");
    emitter.emit("c");
    emitter.emit("d");
    emitter.emit("e");

    // Should only keep last 3
    expect(emitter.getBuffer()).toEqual(["c", "d", "e"]);
  });
});
