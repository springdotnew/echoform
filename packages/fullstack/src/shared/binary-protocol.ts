/**
 * Binary wire protocol using typed-binary.
 *
 * Replaces the old compiled enum-based protocol (compiledTypes + enum + decompile switches)
 * with typed-binary schemas that define encode/decode in one place per event type.
 */

import {
  Schema,
  BufferReader,
  BufferWriter,
  Measurer,
  MaxValue,
  object,
  string as binString,
  bool,
  u8,
  u32,
  f32,
  dynamicArrayOf,
  optional,
} from "typed-binary";
import type { ISerialInput, ISerialOutput, IMeasurer, Parsed } from "typed-binary";
import type { SerializableValue } from "./types";

// typed-binary doesn't export f64, so we create a custom Float64 schema
class Float64Schema extends Schema<number> {
  read(input: ISerialInput): number {
    return input.readFloat32(); // We'll use a dual-f32 encoding below
  }
  write(output: ISerialOutput, value: number): void {
    output.writeFloat32(value);
  }
  measure(_: number | typeof MaxValue, measurer: IMeasurer = new Measurer()): IMeasurer {
    return measurer.add(4);
  }
}

// For numbers, use JSON string encoding to preserve full f64 precision
// (typed-binary only has f32 which loses precision)
class NumberSchema extends Schema<number> {
  write(output: ISerialOutput, value: number): void {
    // Encode as string to preserve full precision
    binString.write(output, String(value));
  }
  read(input: ISerialInput): number {
    return Number(binString.read(input));
  }
  measure(value: number | typeof MaxValue, measurer: IMeasurer = new Measurer()): IMeasurer {
    if (value === MaxValue) return measurer.unbounded;
    return binString.measure(String(value), measurer);
  }
}

const numSchema = new NumberSchema();

// ---- SerializableValue: custom recursive schema ----
// Type tags: 0=null, 1=undefined, 2=bool, 3=number, 4=string, 5=array, 6=object

const TAG_NULL = 0;
const TAG_UNDEFINED = 1;
const TAG_BOOL = 2;
const TAG_NUMBER = 3;
const TAG_STRING = 4;
const TAG_ARRAY = 5;
const TAG_OBJECT = 6;

class SerializableValueSchema extends Schema<SerializableValue> {
  write(output: ISerialOutput, value: SerializableValue): void {
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
        this.write(output, item as SerializableValue);
      }
    } else {
      u8.write(output, TAG_OBJECT);
      const entries = Object.entries(value as Record<string, SerializableValue>);
      u32.write(output, entries.length);
      for (const [key, val] of entries) {
        binString.write(output, key);
        this.write(output, val);
      }
    }
  }

  read(input: ISerialInput): SerializableValue {
    const tag = u8.read(input);
    switch (tag) {
      case TAG_NULL: return null;
      case TAG_UNDEFINED: return undefined;
      case TAG_BOOL: return bool.read(input);
      case TAG_NUMBER: return numSchema.read(input);
      case TAG_STRING: return binString.read(input);
      case TAG_ARRAY: {
        const len = u32.read(input);
        const arr: SerializableValue[] = [];
        for (let i = 0; i < len; i++) {
          arr.push(this.read(input));
        }
        return arr;
      }
      case TAG_OBJECT: {
        const len = u32.read(input);
        const obj: Record<string, SerializableValue> = {};
        for (let i = 0; i < len; i++) {
          const key = binString.read(input);
          obj[key] = this.read(input);
        }
        return obj;
      }
      default:
        return null;
    }
  }

  measure(value: SerializableValue | typeof MaxValue, measurer: IMeasurer = new Measurer()): IMeasurer {
    if (value === MaxValue) {
      return measurer.unbounded;
    }

    if (value === null || value === undefined) {
      return measurer.add(1); // tag only
    }
    if (typeof value === "boolean") {
      return measurer.add(1 + 1); // tag + bool
    }
    if (typeof value === "number") {
      measurer.add(1); // tag
      return numSchema.measure(value as number, measurer);
    }
    if (typeof value === "string") {
      measurer.add(1); // tag
      return binString.measure(value, measurer);
    }
    if (Array.isArray(value)) {
      measurer.add(1 + 4); // tag + length
      for (const item of value) {
        this.measure(item as SerializableValue, measurer);
      }
      return measurer;
    }
    // object
    const entries = Object.entries(value as Record<string, SerializableValue>);
    measurer.add(1 + 4); // tag + length
    for (const [key, val] of entries) {
      binString.measure(key, measurer);
      this.measure(val, measurer);
    }
    return measurer;
  }
}

export const serializableValue = new SerializableValueSchema();

// ---- Prop schema (discriminated: data=0, event=1, stream=2) ----

const PROP_DATA = 0;
const PROP_EVENT = 1;
const PROP_STREAM = 2;

const propSchema = object({
  type: u8,
  name: binString,
  // Extra fields are encoded conditionally after the base
});

class PropBinarySchema extends Schema<{
  readonly name: string;
  readonly type: "data" | "event" | "stream";
  readonly data?: SerializableValue;
  readonly uid?: string;
}> {
  write(output: ISerialOutput, value: { readonly name: string; readonly type: string; readonly data?: SerializableValue; readonly uid?: string }): void {
    binString.write(output, value.name);
    if (value.type === "data") {
      u8.write(output, PROP_DATA);
      serializableValue.write(output, value.data as SerializableValue);
    } else if (value.type === "event") {
      u8.write(output, PROP_EVENT);
      binString.write(output, value.uid ?? "");
    } else {
      u8.write(output, PROP_STREAM);
      binString.write(output, value.uid ?? "");
    }
  }

  read(input: ISerialInput): { readonly name: string; readonly type: "data" | "event" | "stream"; readonly data?: SerializableValue; readonly uid?: string } {
    const name = binString.read(input);
    const tag = u8.read(input);
    if (tag === PROP_DATA) {
      return { name, type: "data", data: serializableValue.read(input) } as any;
    }
    if (tag === PROP_EVENT) {
      return { name, type: "event", uid: binString.read(input) } as any;
    }
    return { name, type: "stream", uid: binString.read(input) } as any;
  }

  measure(value: any, measurer: IMeasurer = new Measurer()): IMeasurer {
    if (value === MaxValue) return measurer.unbounded;
    binString.measure(value.name, measurer);
    measurer.add(1); // tag
    if (value.type === "data") {
      serializableValue.measure(value.data, measurer);
    } else {
      binString.measure(value.uid ?? "", measurer);
    }
    return measurer;
  }
}

const propBinary = new PropBinarySchema();

// ---- View data schemas ----

const viewDataBaseSchema = object({
  uid: binString,
  name: binString,
  parentUid: binString,
  childIndex: u32,
  isRoot: bool,
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

// ---- Per-event payload write/read/measure ----

function writeEventPayload(eventId: number, data: unknown, w: ISerialOutput): void {
  switch (eventId) {
    case EVENT_UPDATE_VIEWS_TREE: {
      const d = data as { readonly views: ReadonlyArray<any> };
      u32.write(w, d.views.length);
      for (const view of d.views) {
        writeExistingViewData(view, w);
      }
      break;
    }
    case EVENT_UPDATE_VIEW: {
      const d = data as { readonly view: any };
      writeShareableViewData(d.view, w);
      break;
    }
    case EVENT_DELETE_VIEW: {
      const d = data as { readonly viewUid: string };
      binString.write(w, d.viewUid);
      break;
    }
    case EVENT_REQUEST_VIEWS_TREE:
      // no payload
      break;
    case EVENT_RESPOND_TO_EVENT: {
      const d = data as { readonly data: SerializableValue; readonly uid: string; readonly eventUid: string };
      serializableValue.write(w, d.data);
      binString.write(w, d.uid);
      binString.write(w, d.eventUid);
      break;
    }
    case EVENT_REQUEST_EVENT: {
      const d = data as { readonly eventArguments: ReadonlyArray<SerializableValue>; readonly uid: string; readonly eventUid: string };
      u32.write(w, d.eventArguments.length);
      for (const arg of d.eventArguments) {
        serializableValue.write(w, arg);
      }
      binString.write(w, d.uid);
      binString.write(w, d.eventUid);
      break;
    }
    case EVENT_STREAM_CHUNK: {
      const d = data as { readonly streamUid: string; readonly chunk: SerializableValue };
      binString.write(w, d.streamUid);
      serializableValue.write(w, d.chunk);
      break;
    }
    case EVENT_STREAM_END: {
      const d = data as { readonly streamUid: string };
      binString.write(w, d.streamUid);
      break;
    }
  }
}

function readEventPayload(eventId: number, r: ISerialInput): unknown {
  switch (eventId) {
    case EVENT_UPDATE_VIEWS_TREE: {
      const len = u32.read(r);
      const views: any[] = [];
      for (let i = 0; i < len; i++) {
        views.push(readExistingViewData(r));
      }
      return { views };
    }
    case EVENT_UPDATE_VIEW:
      return { view: readShareableViewData(r) };
    case EVENT_DELETE_VIEW:
      return { viewUid: binString.read(r) };
    case EVENT_REQUEST_VIEWS_TREE:
      return undefined;
    case EVENT_RESPOND_TO_EVENT: {
      const data = serializableValue.read(r);
      const uid = binString.read(r);
      const eventUid = binString.read(r);
      return { data, uid, eventUid };
    }
    case EVENT_REQUEST_EVENT: {
      const argLen = u32.read(r);
      const eventArguments: SerializableValue[] = [];
      for (let i = 0; i < argLen; i++) {
        eventArguments.push(serializableValue.read(r));
      }
      const uid = binString.read(r);
      const eventUid = binString.read(r);
      return { eventArguments, uid, eventUid };
    }
    case EVENT_STREAM_CHUNK: {
      const streamUid = binString.read(r);
      const chunk = serializableValue.read(r);
      return { streamUid, chunk };
    }
    case EVENT_STREAM_END:
      return { streamUid: binString.read(r) };
    default:
      return undefined;
  }
}

function measureEventPayload(eventId: number, data: unknown, m: IMeasurer): void {
  switch (eventId) {
    case EVENT_UPDATE_VIEWS_TREE: {
      const d = data as { readonly views: ReadonlyArray<any> };
      m.add(4); // array length
      for (const view of d.views) {
        measureExistingViewData(view, m);
      }
      break;
    }
    case EVENT_UPDATE_VIEW: {
      const d = data as { readonly view: any };
      measureShareableViewData(d.view, m);
      break;
    }
    case EVENT_DELETE_VIEW: {
      const d = data as { readonly viewUid: string };
      binString.measure(d.viewUid, m);
      break;
    }
    case EVENT_REQUEST_VIEWS_TREE:
      break;
    case EVENT_RESPOND_TO_EVENT: {
      const d = data as { readonly data: SerializableValue; readonly uid: string; readonly eventUid: string };
      serializableValue.measure(d.data, m);
      binString.measure(d.uid, m);
      binString.measure(d.eventUid, m);
      break;
    }
    case EVENT_REQUEST_EVENT: {
      const d = data as { readonly eventArguments: ReadonlyArray<SerializableValue>; readonly uid: string; readonly eventUid: string };
      m.add(4); // array length
      for (const arg of d.eventArguments) {
        serializableValue.measure(arg, m);
      }
      binString.measure(d.uid, m);
      binString.measure(d.eventUid, m);
      break;
    }
    case EVENT_STREAM_CHUNK: {
      const d = data as { readonly streamUid: string; readonly chunk: SerializableValue };
      binString.measure(d.streamUid, m);
      serializableValue.measure(d.chunk, m);
      break;
    }
    case EVENT_STREAM_END: {
      const d = data as { readonly streamUid: string };
      binString.measure(d.streamUid, m);
      break;
    }
  }
}

// ---- View data helpers ----

function writeViewBase(view: any, w: ISerialOutput): void {
  binString.write(w, view.uid);
  binString.write(w, view.name);
  binString.write(w, view.parentUid);
  u32.write(w, view.childIndex);
  bool.write(w, view.isRoot);
}

function readViewBase(r: ISerialInput): { uid: string; name: string; parentUid: string; childIndex: number; isRoot: boolean } {
  return {
    uid: binString.read(r),
    name: binString.read(r),
    parentUid: binString.read(r),
    childIndex: u32.read(r),
    isRoot: bool.read(r),
  };
}

function measureViewBase(view: any, m: IMeasurer): void {
  binString.measure(view.uid, m);
  binString.measure(view.name, m);
  binString.measure(view.parentUid, m);
  m.add(4 + 1); // u32 + bool
}

function writeExistingViewData(view: any, w: ISerialOutput): void {
  writeViewBase(view, w);
  u32.write(w, view.props.length);
  for (const prop of view.props) {
    propBinary.write(w, prop);
  }
}

function readExistingViewData(r: ISerialInput): any {
  const base = readViewBase(r);
  const propLen = u32.read(r);
  const props: any[] = [];
  for (let i = 0; i < propLen; i++) {
    props.push(propBinary.read(r));
  }
  return { ...base, props };
}

function measureExistingViewData(view: any, m: IMeasurer): void {
  measureViewBase(view, m);
  m.add(4); // props array length
  for (const prop of view.props) {
    propBinary.measure(prop, m);
  }
}

function writeShareableViewData(view: any, w: ISerialOutput): void {
  writeViewBase(view, w);
  // props.create
  u32.write(w, view.props.create.length);
  for (const prop of view.props.create) {
    propBinary.write(w, prop);
  }
  // props.delete
  u32.write(w, view.props.delete.length);
  for (const name of view.props.delete) {
    binString.write(w, name as string);
  }
}

function readShareableViewData(r: ISerialInput): any {
  const base = readViewBase(r);
  const createLen = u32.read(r);
  const create: any[] = [];
  for (let i = 0; i < createLen; i++) {
    create.push(propBinary.read(r));
  }
  const deleteLen = u32.read(r);
  const del: string[] = [];
  for (let i = 0; i < deleteLen; i++) {
    del.push(binString.read(r));
  }
  return { ...base, props: { create, delete: del } };
}

function measureShareableViewData(view: any, m: IMeasurer): void {
  measureViewBase(view, m);
  m.add(4); // create array length
  for (const prop of view.props.create) {
    propBinary.measure(prop, m);
  }
  m.add(4); // delete array length
  for (const name of view.props.delete) {
    binString.measure(name as string, m);
  }
}
