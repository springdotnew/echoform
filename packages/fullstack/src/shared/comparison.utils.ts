/**
 * Comparison utilities for deep equality checks.
 */

import type { SerializableValue } from "./types";

/**
 * Deep equality comparison for serializable values.
 * Uses strict comparison for primitives and recursive comparison for objects/arrays.
 */
export function deeplyEqual(x: SerializableValue, y: SerializableValue): boolean {
  if (x === y) {
    return true;
  }

  if (
    typeof x === "object" &&
    x !== null &&
    typeof y === "object" &&
    y !== null
  ) {
    if (Array.isArray(x) && Array.isArray(y)) {
      if (x.length !== y.length) {
        return false;
      }
      for (let i = 0; i < x.length; i++) {
        if (!deeplyEqual(x[i], y[i])) {
          return false;
        }
      }
      return true;
    }

    if (Array.isArray(x) || Array.isArray(y)) {
      return false;
    }

    const xRecord = x as Readonly<Record<string, SerializableValue>>;
    const yRecord = y as Readonly<Record<string, SerializableValue>>;

    const xKeys = Object.keys(xRecord);
    const yKeys = Object.keys(yRecord);

    if (xKeys.length !== yKeys.length) {
      return false;
    }

    for (const prop of xKeys) {
      if (!Object.prototype.hasOwnProperty.call(yRecord, prop)) {
        return false;
      }
      if (!deeplyEqual(xRecord[prop], yRecord[prop])) {
        return false;
      }
    }

    return true;
  }

  return false;
}
