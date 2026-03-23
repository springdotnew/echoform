/**
 * Comparison utilities for deep equality checks.
 */

import type { SerializableValue } from "./types";

/**
 * Deep equality comparison for serializable values.
 * Uses strict comparison for primitives and recursive comparison for objects/arrays.
 */
export function deeplyEqual(x: SerializableValue, y: SerializableValue): boolean {
  if (x === y) return true;
  if (typeof x !== "object" || x === null || typeof y !== "object" || y === null) return false;

  const xIsArray = Array.isArray(x);
  const yIsArray = Array.isArray(y);
  if (xIsArray !== yIsArray) return false;

  if (xIsArray && yIsArray) return areArraysEqual(x, y);

  return areRecordsEqual(
    x as Readonly<Record<string, SerializableValue>>,
    y as Readonly<Record<string, SerializableValue>>,
  );
}

function areArraysEqual(x: ReadonlyArray<SerializableValue>, y: ReadonlyArray<SerializableValue>): boolean {
  if (x.length !== y.length) return false;

  for (let i = 0; i < x.length; i++) {
    if (!deeplyEqual(x[i], y[i])) return false;
  }
  return true;
}

function areRecordsEqual(
  x: Readonly<Record<string, SerializableValue>>,
  y: Readonly<Record<string, SerializableValue>>,
): boolean {
  const xKeys = Object.keys(x);
  if (xKeys.length !== Object.keys(y).length) return false;

  for (const prop of xKeys) {
    if (!Object.prototype.hasOwnProperty.call(y, prop)) return false;
    if (!deeplyEqual(x[prop], y[prop])) return false;
  }
  return true;
}
