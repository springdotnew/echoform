/**
 * Binary wire protocol using typed-binary.
 *
 * Replaces the old compiled enum-based protocol (compiledTypes + enum + decompile switches)
 * with typed-binary schemas that define encode/decode in one place per event type.
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
} from "typed-binary";
import type { ISchema, ISerialInput, ISerialOutput, IMeasurer, IRefResolver } from "typed-binary";
import type { SerializableValue } from "./types";

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

/** Read `count` items from a binary stream. Mutation is scoped: the array never escapes until complete. */
function readArray<T>(count: number, readItem: (input: ISerialInput) => T, input: ISerialInput): T[] {
  const items: T[] = [];
  for (let i = 0; i < count; i++) {
    items.push(readItem(input));
  }
  return items;
}

// For numbers, use JSON string encoding to preserve full f64 precision
// (typed-binary only has f32 which loses precision)
const numSchema = createSchema<number>({
  write(output, value) {
    binString.write(output, String(value));
  },
  read(input) {
    return Number(binString.read(input));
  },
  measure(value, measurer) {
    if (value === MaxValue) return measurer.unbounded;
    return binString.measure(String(value as number), measurer);
  },
});

// ---- SerializableValue: custom recursive schema ----
// Type tags: 0=null, 1=undefined, 2=bool, 3=number, 4=string, 5=array, 6=object

const TAG_NULL = 0;
const TAG_UNDEFINED = 1;
const TAG_BOOL = 2;
const TAG_NUMBER = 3;
const TAG_STRING = 4;
const TAG_ARRAY = 5;
const TAG_OBJECT = 6;

function writeSerializableValue(output: ISerialOutput, value: SerializableValue): void {
  if (value === null) {
    u8.write(output, TAG_NULL);
  } else if (value === undefined) {
    u8.write(output, TAG_UNDEFINED);
  } else if (typeof value === "boolean") {
    u8.write(output, TAG_BOOL);
    bool.write(output, value);
  } else if (typeof value === "number") {
    u8.write(output, TAG_NUMBER);
    numSchema.write(output, value);
  } else if (typeof value === "string") {
    u8.write(output, TAG_STRING);
    binString.write(output, value);
  } else if (Array.isArray(value)) {
    u8.write(output, TAG_ARRAY);
    u32.write(output, value.length);
    for (const item of value) {
      writeSerializableValue(output, item as SerializableValue);
    }
  } else {
    u8.write(output, TAG_OBJECT);
    const entries = Object.entries(value as Record<string, SerializableValue>);
    u32.write(output, entries.length);
    for (const [key, entryValue] of entries) {
      binString.write(output, key);
      writeSerializableValue(output, entryValue);
    }
  }
}

function readObjectValue(input: ISerialInput, length: number): Record<string, SerializableValue> {
  const result: Record<string, SerializableValue> = {};
  for (let i = 0; i < length; i++) {
    const key = binString.read(input);
    result[key] = readSerializableValue(input);
  }
  return result;
}

function readSerializableValue(input: ISerialInput): SerializableValue {
  const tag = u8.read(input);
  switch (tag) {
    case TAG_NULL: return null;
    case TAG_UNDEFINED: return undefined;
    case TAG_BOOL: return bool.read(input);
    case TAG_NUMBER: return numSchema.read(input);
    case TAG_STRING: return binString.read(input);
    case TAG_ARRAY: {
      const len = u32.read(input);
      return readArray(len, readSerializableValue, input);
    }
    case TAG_OBJECT: {
      return readObjectValue(input, u32.read(input));
    }
    default:
      return null;
  }
}

function measureSerializableValue(value: SerializableValue | typeof MaxValue, measurer: IMeasurer): IMeasurer {
  if (value === MaxValue) return measurer.unbounded;
  if (value === null || value === undefined) return measurer.add(1);
  if (typeof value === "boolean") return measurer.add(1 + 1);
  if (typeof value === "number") {
    measurer.add(1);
    return numSchema.measure(value as number, measurer);
  }
  if (typeof value === "string") {
    measurer.add(1);
    return binString.measure(value, measurer);
  }
  if (Array.isArray(value)) {
    measurer.add(1 + 4);
    for (const item of value) {
      measureSerializableValue(item as SerializableValue, measurer);
    }
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
  read: readSerializableValue,
  measure: measureSerializableValue,
});

// ---- Prop schema (discriminated: data=0, event=1, stream=2) ----

const PROP_DATA = 0;
const PROP_EVENT = 1;
const PROP_STREAM = 2;

// ---- Wire prop types (unbranded, as they appear on the binary wire) ----

interface BinaryDataProp {
  readonly name: string;
  readonly type: "data";
  readonly data: SerializableValue;
}

interface BinaryEventProp {
  readonly name: string;
  readonly type: "event";
  readonly uid: string;
}

interface BinaryStreamProp {
  readonly name: string;
  readonly type: "stream";
  readonly uid: string;
}

type BinaryProp = BinaryDataProp | BinaryEventProp | BinaryStreamProp;

const propBinary = createSchema<BinaryProp>({
  write(output, value) {
    binString.write(output, value.name);
    if (value.type === "data") {
      u8.write(output, PROP_DATA);
      serializableValue.write(output, value.data);
    } else if (value.type === "event") {
      u8.write(output, PROP_EVENT);
      binString.write(output, value.uid);
    } else {
      u8.write(output, PROP_STREAM);
      binString.write(output, value.uid);
    }
  },
  read(input) {
    const name = binString.read(input);
    const tag = u8.read(input);
    if (tag === PROP_DATA) {
      return { name, type: "data", data: serializableValue.read(input) };
    }
    if (tag === PROP_EVENT) {
      return { name, type: "event", uid: binString.read(input) };
    }
    return { name, type: "stream", uid: binString.read(input) };
  },
  measure(value, measurer) {
    if (value === MaxValue) return measurer.unbounded;
    binString.measure(value.name, measurer);
    measurer.add(1);
    if (value.type === "data") {
      serializableValue.measure(value.data, measurer);
    } else {
      binString.measure(value.uid, measurer);
    }
    return measurer;
  },
});

// ---- Event type discriminator ----

const EVENT_UPDATE_VIEWS_TREE = 0;
const EVENT_UPDATE_VIEW = 1;
const EVENT_DELETE_VIEW = 2;
const EVENT_REQUEST_VIEWS_TREE = 3;
const EVENT_RESPOND_TO_EVENT = 4;
const EVENT_REQUEST_EVENT = 5;
const EVENT_STREAM_CHUNK = 6;
const EVENT_STREAM_END = 7;

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
  "update_views_tree",
  "update_view",
  "delete_view",
  "request_views_tree",
  "respond_to_event",
  "request_event",
  "stream_chunk",
  "stream_end",
];

// ---- Wire message: encode/decode ----

export interface WireMessage {
  readonly event: string;
  readonly data: unknown;
}

/**
 * Encode an event + payload into a binary Uint8Array.
 */
export function encodeMessage(event: string, data: unknown): Uint8Array {
  const eventId = eventNameToId[event];
  if (eventId === undefined) {
    // Unknown event: fall back to JSON-in-binary (event name + serializable data)
    const measurer = new Measurer();
    measurer.add(1); // tag byte (0xFF = fallback)
    binString.measure(event, measurer);
    serializableValue.measure(data as SerializableValue, measurer);

    const buffer = new ArrayBuffer(measurer.size);
    const writer = new BufferWriter(buffer);
    u8.write(writer, 0xFF);
    binString.write(writer, event);
    serializableValue.write(writer, data as SerializableValue);
    return new Uint8Array(buffer);
  }

  // Measure
  const measurer = new Measurer();
  measurer.add(1); // event type tag
  measureEventPayload(eventId, data, measurer);

  const buffer = new ArrayBuffer(measurer.size);
  const writer = new BufferWriter(buffer);
  u8.write(writer, eventId);
  writeEventPayload(eventId, data, writer);

  return new Uint8Array(buffer);
}

/**
 * Decode a binary Uint8Array back into an event name + payload.
 */
export function decodeMessage(bytes: Uint8Array): WireMessage {
  const reader = new BufferReader(bytes.buffer, { byteOffset: bytes.byteOffset });
  const eventId = u8.read(reader);

  if (eventId === 0xFF) {
    // Fallback: JSON-in-binary
    const event = binString.read(reader);
    const data = serializableValue.read(reader);
    return { event, data };
  }

  const event = idToEventName[eventId];
  if (!event) {
    return { event: "unknown", data: undefined };
  }

  const data = readEventPayload(eventId, reader);
  return { event, data };
}

// ---- Wire view types (unbranded, as they appear on the binary wire) ----

interface BinaryViewBase {
  readonly uid: string;
  readonly name: string;
  readonly parentUid: string;
  readonly childIndex: number;
  readonly isRoot: boolean;
}

interface BinaryExistingViewData extends BinaryViewBase {
  readonly props: ReadonlyArray<BinaryProp>;
}

interface BinaryShareableViewData extends BinaryViewBase {
  readonly props: {
    readonly create: ReadonlyArray<BinaryProp>;
    readonly delete: ReadonlyArray<string>;
  };
}

// ---- Wire event payload types ----

type WireUpdateViewsTree = { readonly views: ReadonlyArray<BinaryExistingViewData> };
type WireUpdateView = { readonly view: BinaryShareableViewData };
type WireDeleteView = { readonly viewUid: string };
type WireRespondToEvent = { readonly data: SerializableValue; readonly uid: string; readonly eventUid: string };
type WireRequestEvent = { readonly eventArguments: ReadonlyArray<SerializableValue>; readonly uid: string; readonly eventUid: string };
type WireStreamChunk = { readonly streamUid: string; readonly chunk: SerializableValue };
type WireStreamEnd = { readonly streamUid: string };

// ---- Per-event codec: groups write/read/measure for each event type ----

interface EventCodec<T> {
  readonly write: (data: T, w: ISerialOutput) => void;
  readonly read: (r: ISerialInput) => T;
  readonly measure: (data: T, m: IMeasurer) => void;
}

const updateViewsTreeCodec: EventCodec<WireUpdateViewsTree> = {
  write(data, w) {
    u32.write(w, data.views.length);
    for (const view of data.views) {
      writeExistingViewData(view, w);
    }
  },
  read(r) {
    const len = u32.read(r);
    return { views: readArray(len, readExistingViewData, r) };
  },
  measure(data, m) {
    m.add(4);
    for (const view of data.views) {
      measureExistingViewData(view, m);
    }
  },
};

const updateViewCodec: EventCodec<WireUpdateView> = {
  write(data, w) { writeShareableViewData(data.view, w); },
  read(r) { return { view: readShareableViewData(r) }; },
  measure(data, m) { measureShareableViewData(data.view, m); },
};

const deleteViewCodec: EventCodec<WireDeleteView> = {
  write(data, w) { binString.write(w, data.viewUid); },
  read(r) { return { viewUid: binString.read(r) }; },
  measure(data, m) { binString.measure(data.viewUid, m); },
};

const requestViewsTreeCodec: EventCodec<void> = {
  write() {},
  read() { return undefined as void; },
  measure() {},
};

const respondToEventCodec: EventCodec<WireRespondToEvent> = {
  write(data, w) {
    serializableValue.write(w, data.data);
    binString.write(w, data.uid);
    binString.write(w, data.eventUid);
  },
  read(r) {
    const data = serializableValue.read(r);
    const uid = binString.read(r);
    const eventUid = binString.read(r);
    return { data, uid, eventUid };
  },
  measure(data, m) {
    serializableValue.measure(data.data, m);
    binString.measure(data.uid, m);
    binString.measure(data.eventUid, m);
  },
};

const requestEventCodec: EventCodec<WireRequestEvent> = {
  write(data, w) {
    u32.write(w, data.eventArguments.length);
    for (const arg of data.eventArguments) {
      serializableValue.write(w, arg);
    }
    binString.write(w, data.uid);
    binString.write(w, data.eventUid);
  },
  read(r) {
    const argLen = u32.read(r);
    const eventArguments = readArray(argLen, (r) => serializableValue.read(r), r);
    const uid = binString.read(r);
    const eventUid = binString.read(r);
    return { eventArguments, uid, eventUid };
  },
  measure(data, m) {
    m.add(4);
    for (const arg of data.eventArguments) {
      serializableValue.measure(arg, m);
    }
    binString.measure(data.uid, m);
    binString.measure(data.eventUid, m);
  },
};

const streamChunkCodec: EventCodec<WireStreamChunk> = {
  write(data, w) {
    binString.write(w, data.streamUid);
    serializableValue.write(w, data.chunk);
  },
  read(r) {
    const streamUid = binString.read(r);
    const chunk = serializableValue.read(r);
    return { streamUid, chunk };
  },
  measure(data, m) {
    binString.measure(data.streamUid, m);
    serializableValue.measure(data.chunk, m);
  },
};

const streamEndCodec: EventCodec<WireStreamEnd> = {
  write(data, w) { binString.write(w, data.streamUid); },
  read(r) { return { streamUid: binString.read(r) }; },
  measure(data, m) { binString.measure(data.streamUid, m); },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const eventCodecs: ReadonlyArray<EventCodec<any> | undefined> = [
  updateViewsTreeCodec,   // 0 = EVENT_UPDATE_VIEWS_TREE
  updateViewCodec,        // 1 = EVENT_UPDATE_VIEW
  deleteViewCodec,        // 2 = EVENT_DELETE_VIEW
  requestViewsTreeCodec,  // 3 = EVENT_REQUEST_VIEWS_TREE
  respondToEventCodec,    // 4 = EVENT_RESPOND_TO_EVENT
  requestEventCodec,      // 5 = EVENT_REQUEST_EVENT
  streamChunkCodec,       // 6 = EVENT_STREAM_CHUNK
  streamEndCodec,         // 7 = EVENT_STREAM_END
];

function writeEventPayload(eventId: number, data: unknown, w: ISerialOutput): void {
  eventCodecs[eventId]?.write(data, w);
}

function readEventPayload(eventId: number, r: ISerialInput): unknown {
  return eventCodecs[eventId]?.read(r);
}

function measureEventPayload(eventId: number, data: unknown, m: IMeasurer): void {
  eventCodecs[eventId]?.measure(data, m);
}

// ---- View data helpers ----

function writeViewBase(view: BinaryViewBase, w: ISerialOutput): void {
  binString.write(w, view.uid);
  binString.write(w, view.name);
  binString.write(w, view.parentUid);
  u32.write(w, view.childIndex);
  bool.write(w, view.isRoot);
}

function readViewBase(r: ISerialInput): BinaryViewBase {
  return {
    uid: binString.read(r),
    name: binString.read(r),
    parentUid: binString.read(r),
    childIndex: u32.read(r),
    isRoot: bool.read(r),
  };
}

function measureViewBase(view: BinaryViewBase, m: IMeasurer): void {
  binString.measure(view.uid, m);
  binString.measure(view.name, m);
  binString.measure(view.parentUid, m);
  m.add(4 + 1); // u32 + bool
}

function writeExistingViewData(view: BinaryExistingViewData, w: ISerialOutput): void {
  writeViewBase(view, w);
  u32.write(w, view.props.length);
  for (const prop of view.props) {
    propBinary.write(w, prop);
  }
}

function readExistingViewData(r: ISerialInput): BinaryExistingViewData {
  const base = readViewBase(r);
  const propLen = u32.read(r);
  return { ...base, props: readArray(propLen, (r) => propBinary.read(r), r) };
}

function measureExistingViewData(view: BinaryExistingViewData, m: IMeasurer): void {
  measureViewBase(view, m);
  m.add(4); // props array length
  for (const prop of view.props) {
    propBinary.measure(prop, m);
  }
}

function writeShareableViewData(view: BinaryShareableViewData, w: ISerialOutput): void {
  writeViewBase(view, w);
  u32.write(w, view.props.create.length);
  for (const prop of view.props.create) {
    propBinary.write(w, prop);
  }
  u32.write(w, view.props.delete.length);
  for (const name of view.props.delete) {
    binString.write(w, name);
  }
}

function readShareableViewData(r: ISerialInput): BinaryShareableViewData {
  const base = readViewBase(r);
  const createLen = u32.read(r);
  const create = readArray(createLen, (r) => propBinary.read(r), r);
  const deleteLen = u32.read(r);
  const del = readArray(deleteLen, (r) => binString.read(r), r);
  return { ...base, props: { create, delete: del } };
}

function measureShareableViewData(view: BinaryShareableViewData, m: IMeasurer): void {
  measureViewBase(view, m);
  m.add(4); // create array length
  for (const prop of view.props.create) {
    propBinary.measure(prop, m);
  }
  m.add(4); // delete array length
  for (const name of view.props.delete) {
    binString.measure(name, m);
  }
}
