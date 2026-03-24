/**
 * Binary wire protocol using typed-binary.
 *
 * Uses typed-binary's high-level `object()`, `dynamicArrayOf()`, and `concat()`
 * for view/event schemas. Custom codecs remain only where the wire format
 * requires non-standard handling (recursive SerializableValue, prop discriminant
 * ordering, respond_to_event backward compat).
 */

import {
  BufferReader,
  BufferWriter,
  Measurer,
  MaxValue,
  string as binString,
  bool,
  u8,
  u32,
  object,
  dynamicArrayOf,
  concat,
} from "typed-binary";
import type { ISchema, ISerialInput, ISerialOutput, IMeasurer, IRefResolver } from "typed-binary";
import type { SerializableValue } from "./types";

// ---- Custom schema helper (for codecs that can't use built-in object()) ----

type SchemaImpl<T> = {
  readonly write: (output: ISerialOutput, value: T) => void;
  readonly read: (input: ISerialInput) => T;
  readonly measure: (value: T | typeof MaxValue, measurer: IMeasurer) => IMeasurer;
};

function createSchema<T>(impl: SchemaImpl<T>): ISchema<T> {
  return {
    __unwrapped: undefined as unknown as T,
    resolveReferences(_ctx: IRefResolver): void {},
    seekProperty(): null { return null; },
    write: impl.write as ISchema<T>["write"],
    read: impl.read as ISchema<T>["read"],
    measure(value, measurer: IMeasurer = new Measurer()): IMeasurer {
      return impl.measure(value as T | typeof MaxValue, measurer);
    },
  } as ISchema<T>;
}

// ---- Number schema: string-encoded for f64 precision (typed-binary only has f32) ----

const numSchema = createSchema<number>({
  write(output, value) { binString.write(output, String(value)); },
  read(input) { return Number(binString.read(input)); },
  measure(value, measurer) {
    if (value === MaxValue) return measurer.unbounded;
    return binString.measure(String(value as number), measurer);
  },
});

// ---- SerializableValue: custom recursive schema ----
// Must remain custom: recursive with depth guard, tag-dispatch wire format

const TAG_NULL = 0;
const TAG_UNDEFINED = 1;
const TAG_BOOL = 2;
const TAG_NUMBER = 3;
const TAG_STRING = 4;
const TAG_ARRAY = 5;
const TAG_OBJECT = 6;

const MAX_NESTING_DEPTH = 64;
const MAX_COLLECTION_LENGTH = 100_000;

function readBoundedArray<T>(count: number, readItem: (input: ISerialInput) => T, input: ISerialInput): T[] {
  if (count > MAX_COLLECTION_LENGTH) throw new Error("Collection length exceeds maximum");
  const items: T[] = [];
  for (let i = 0; i < count; i++) {
    items.push(readItem(input));
  }
  return items;
}

function writeSerializableValue(output: ISerialOutput, value: SerializableValue): void {
  if (value === null) { u8.write(output, TAG_NULL); return; }
  if (value === undefined) { u8.write(output, TAG_UNDEFINED); return; }
  if (typeof value === "boolean") { u8.write(output, TAG_BOOL); bool.write(output, value); return; }
  if (typeof value === "number") { u8.write(output, TAG_NUMBER); numSchema.write(output, value); return; }
  if (typeof value === "string") { u8.write(output, TAG_STRING); binString.write(output, value); return; }

  if (Array.isArray(value)) {
    u8.write(output, TAG_ARRAY);
    u32.write(output, value.length);
    for (const item of value) writeSerializableValue(output, item as SerializableValue);
    return;
  }

  u8.write(output, TAG_OBJECT);
  const entries = Object.entries(value as Record<string, SerializableValue>);
  u32.write(output, entries.length);
  for (const [key, entryValue] of entries) {
    binString.write(output, key);
    writeSerializableValue(output, entryValue);
  }
}

function readObjectValue(input: ISerialInput, length: number, depth: number): Record<string, SerializableValue> {
  if (length > MAX_COLLECTION_LENGTH) throw new Error("Object key count exceeds maximum");
  const result: Record<string, SerializableValue> = Object.create(null) as Record<string, SerializableValue>;
  for (let i = 0; i < length; i++) {
    const key = binString.read(input);
    result[key] = readSerializableValue(input, depth);
  }
  return result;
}

function readSerializableValue(input: ISerialInput, depth: number): SerializableValue {
  if (depth > MAX_NESTING_DEPTH) throw new Error("Maximum nesting depth exceeded");
  const tag = u8.read(input);
  switch (tag) {
    case TAG_NULL: return null;
    case TAG_UNDEFINED: return undefined;
    case TAG_BOOL: return bool.read(input);
    case TAG_NUMBER: return numSchema.read(input);
    case TAG_STRING: return binString.read(input);
    case TAG_ARRAY: return readBoundedArray(u32.read(input), (inp) => readSerializableValue(inp, depth + 1), input);
    case TAG_OBJECT: return readObjectValue(input, u32.read(input), depth + 1);
    default: return null;
  }
}

function measureSerializableValue(value: SerializableValue | typeof MaxValue, measurer: IMeasurer): IMeasurer {
  if (value === MaxValue) return measurer.unbounded;
  if (value === null || value === undefined) return measurer.add(1);
  if (typeof value === "boolean") return measurer.add(1 + 1);
  if (typeof value === "number") { measurer.add(1); return numSchema.measure(value as number, measurer); }
  if (typeof value === "string") { measurer.add(1); return binString.measure(value, measurer); }

  if (Array.isArray(value)) {
    measurer.add(1 + 4);
    for (const item of value) measureSerializableValue(item as SerializableValue, measurer);
    return measurer;
  }

  const entries = Object.entries(value as Record<string, SerializableValue>);
  measurer.add(1 + 4);
  for (const [key, entryValue] of entries) {
    binString.measure(key, measurer);
    measureSerializableValue(entryValue, measurer);
  }
  return measurer;
}

export const serializableValue = createSchema<SerializableValue>({
  write: writeSerializableValue,
  read: (input) => readSerializableValue(input, 0),
  measure: measureSerializableValue,
});

// ---- Prop schema: custom because wire order is name→tag→payload (not tag-first) ----

const PROP_DATA = 0;
const PROP_EVENT = 1;
const PROP_STREAM = 2;

interface BinaryDataProp { readonly name: string; readonly type: "data"; readonly data: SerializableValue }
interface BinaryEventProp { readonly name: string; readonly type: "event"; readonly uid: string }
interface BinaryStreamProp { readonly name: string; readonly type: "stream"; readonly uid: string }
type BinaryProp = BinaryDataProp | BinaryEventProp | BinaryStreamProp;

const propBinary = createSchema<BinaryProp>({
  write(output, value) {
    binString.write(output, value.name);
    if (value.type === "data") { u8.write(output, PROP_DATA); serializableValue.write(output, value.data); return; }
    if (value.type === "event") { u8.write(output, PROP_EVENT); binString.write(output, value.uid); return; }
    u8.write(output, PROP_STREAM); binString.write(output, value.uid);
  },
  read(input) {
    const name = binString.read(input);
    const tag = u8.read(input);
    if (tag === PROP_DATA) return { name, type: "data", data: serializableValue.read(input) };
    if (tag === PROP_EVENT) return { name, type: "event", uid: binString.read(input) };
    return { name, type: "stream", uid: binString.read(input) };
  },
  measure(value, measurer) {
    if (value === MaxValue) return measurer.unbounded;
    binString.measure(value.name, measurer);
    measurer.add(1);
    if (value.type === "data") { serializableValue.measure(value.data, measurer); }
    else { binString.measure(value.uid, measurer); }
    return measurer;
  },
});

// ---- View schemas (using typed-binary object/concat/dynamicArrayOf) ----

const viewBaseSchema = object({
  uid: binString,
  name: binString,
  parentUid: binString,
  childIndex: u32,
  isRoot: bool,
});

const existingViewDataSchema = concat([
  viewBaseSchema,
  object({ props: dynamicArrayOf(propBinary) }),
]);

const shareableViewDataSchema = concat([
  viewBaseSchema,
  object({
    props: object({
      create: dynamicArrayOf(propBinary),
      delete: dynamicArrayOf(binString),
    }),
  }),
]);

// ---- Event payload schemas ----

const EVENT_UPDATE_VIEWS_TREE = 0;
const EVENT_UPDATE_VIEW = 1;
const EVENT_DELETE_VIEW = 2;
const EVENT_REQUEST_VIEWS_TREE = 3;
const EVENT_RESPOND_TO_EVENT = 4;
const EVENT_REQUEST_EVENT = 5;
const EVENT_STREAM_CHUNK = 6;
const EVENT_STREAM_END = 7;
const EVENT_FALLBACK = 0xFF;

const updateViewsTreeSchema = object({ views: dynamicArrayOf(existingViewDataSchema) });
const updateViewSchema = object({ view: shareableViewDataSchema });
const deleteViewSchema = object({ viewUid: binString });
const requestEventSchema = object({ eventArguments: dynamicArrayOf(serializableValue), uid: binString, eventUid: binString });
const streamChunkSchema = object({ streamUid: binString, chunk: serializableValue });
const streamEndSchema = object({ streamUid: binString });

const voidSchema = createSchema<void>({
  write() {},
  read() { return undefined as void; },
  measure(_value, measurer) { return measurer; },
});

// respond_to_event: custom because of backward-compat try/catch for optional error field
type WireRespondToEvent = { readonly data: SerializableValue; readonly uid: string; readonly eventUid: string; readonly error?: string };

const respondToEventSchema = createSchema<WireRespondToEvent>({
  write(output, value) {
    serializableValue.write(output, value.data);
    binString.write(output, value.uid);
    binString.write(output, value.eventUid);
    bool.write(output, value.error !== undefined);
    if (value.error !== undefined) binString.write(output, value.error);
  },
  read(input) {
    const data = serializableValue.read(input);
    const uid = binString.read(input);
    const eventUid = binString.read(input);
    let hasError = false;
    try { hasError = bool.read(input); } catch { return { data, uid, eventUid }; }
    if (hasError) return { data, uid, eventUid, error: binString.read(input) };
    return { data, uid, eventUid };
  },
  measure(value, measurer) {
    if (value === MaxValue) return measurer.unbounded;
    serializableValue.measure(value.data, measurer);
    binString.measure(value.uid, measurer);
    binString.measure(value.eventUid, measurer);
    measurer.add(1);
    if (value.error !== undefined) binString.measure(value.error, measurer);
    return measurer;
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const eventSchemas: ReadonlyArray<ISchema<any>> = [
  updateViewsTreeSchema,  // 0
  updateViewSchema,       // 1
  deleteViewSchema,       // 2
  voidSchema,             // 3
  respondToEventSchema,   // 4
  requestEventSchema,     // 5
  streamChunkSchema,      // 6
  streamEndSchema,        // 7
];

// ---- Lookup tables ----

const eventNameToId: Record<string, number> = {
  update_views_tree: EVENT_UPDATE_VIEWS_TREE,
  update_view: EVENT_UPDATE_VIEW,
  delete_view: EVENT_DELETE_VIEW,
  request_views_tree: EVENT_REQUEST_VIEWS_TREE,
  respond_to_event: EVENT_RESPOND_TO_EVENT,
  request_event: EVENT_REQUEST_EVENT,
  stream_chunk: EVENT_STREAM_CHUNK,
  stream_end: EVENT_STREAM_END,
};

const idToEventName: readonly string[] = [
  "update_views_tree", "update_view", "delete_view", "request_views_tree",
  "respond_to_event", "request_event", "stream_chunk", "stream_end",
];

// ---- Wire message: encode/decode ----

export interface WireMessage {
  readonly event: string;
  readonly data: unknown;
}

export function encodeMessage(event: string, data: unknown): Uint8Array {
  const eventId = eventNameToId[event];

  if (eventId === undefined) {
    const measurer = new Measurer();
    measurer.add(1);
    binString.measure(event, measurer);
    serializableValue.measure(data as SerializableValue, measurer);
    const buffer = new ArrayBuffer(measurer.size);
    const writer = new BufferWriter(buffer);
    u8.write(writer, EVENT_FALLBACK);
    binString.write(writer, event);
    serializableValue.write(writer, data as SerializableValue);
    return new Uint8Array(buffer);
  }

  const schema = eventSchemas[eventId]!;
  const measurer = new Measurer();
  measurer.add(1);
  schema.measure(data, measurer);
  const buffer = new ArrayBuffer(measurer.size);
  const writer = new BufferWriter(buffer);
  u8.write(writer, eventId);
  schema.write(writer, data);
  return new Uint8Array(buffer);
}

export function decodeMessage(bytes: Uint8Array): WireMessage {
  const reader = new BufferReader(bytes.buffer, { byteOffset: bytes.byteOffset });
  const eventId = u8.read(reader);

  if (eventId === EVENT_FALLBACK) {
    return { event: binString.read(reader), data: serializableValue.read(reader) };
  }

  const event = idToEventName[eventId];
  if (!event) return { event: "unknown", data: undefined };

  return { event, data: eventSchemas[eventId]?.read(reader) };
}
