/**
 * Comparison utilities using binary serialization + fossil-delta.
 * Avoids recursive deep-equality traversal by serializing values to
 * binary via the typed-binary encoder and comparing the byte output.
 *
 * fossil-delta's createDelta is used to produce compact diffs for
 * downstream consumers; byte-level equality uses direct comparison.
 */

import { createDelta } from "fossil-delta";
import type { SerializableValue } from "./types";
import { serializableValue } from "./binary-protocol";
import { Measurer, BufferWriter } from "typed-binary";

function serializeToBytes(value: SerializableValue): Uint8Array {
  const measurer = new Measurer();
  serializableValue.measure(value, measurer);
  const buffer = new ArrayBuffer(measurer.size);
  const writer = new BufferWriter(buffer);
  serializableValue.write(writer, value);
  return new Uint8Array(buffer);
}

function areBytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Compare two serializable values for equality by serializing to binary
 * and comparing bytes. Faster than recursive deep comparison for large
 * nested structures since it leverages the existing binary encoder.
 */
export function deeplyEqual(x: SerializableValue, y: SerializableValue): boolean {
  if (x === y) return true;
  if (typeof x !== "object" || x === null || typeof y !== "object" || y === null) return false;

  return areBytesEqual(serializeToBytes(x), serializeToBytes(y));
}

/**
 * Compute a compact binary delta between two serializable values
 * using the fossil-delta algorithm. Useful for efficient wire transfer
 * of view prop changes.
 */
export function computeDelta(oldValue: SerializableValue, newValue: SerializableValue): Uint8Array {
  return createDelta(serializeToBytes(oldValue), serializeToBytes(newValue));
}
