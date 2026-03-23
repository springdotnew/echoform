/**
 * Serialization utilities for safe JSON conversion.
 */

import type { SerializableValue } from "./types";

/**
 * Error thrown when attempting to serialize prohibited values like DOM Events.
 */
export function createSerializationError(message: string): Error {
  const error = new Error(message);
  error.name = 'SerializationError';
  return error;
}

/**
 * Creates a replacer function that handles circular references in JSON serialization.
 * Uses a WeakSet to track seen objects and returns undefined for circular refs.
 */
function getCircularReplacer(): (key: string, value: unknown) => unknown {
  const seen = new WeakSet<object>();
  return (_key: string, value: unknown): unknown => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return undefined;
      }
      seen.add(value);
    }
    return value;
  };
}

/**
 * Type guard to check if a value is a DOM Event or React synthetic event.
 */
function isProhibitedEvent(value: unknown): boolean {
  if (typeof Event !== 'undefined' && value instanceof Event) {
    return true;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "_reactName" in value
  ) {
    return true;
  }
  return false;
}

/**
 * Recursively checks if any value in an array is a prohibited event.
 */
function hasProhibitedEvent(values: ReadonlyArray<SerializableValue>): boolean {
  for (const value of values) {
    if (isProhibitedEvent(value)) {
      return true;
    }
    if (Array.isArray(value) && hasProhibitedEvent(value)) {
      return true;
    }
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const objValues = Object.values(value as Record<string, SerializableValue>);
      if (hasProhibitedEvent(objValues)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Serializes an array to JSON, handling circular references.
 * Throws SerializationError if the array contains DOM Events or React synthetic events.
 *
 * @throws {SerializationError} When array contains Event or React synthetic event objects
 */
export function stringifyWithoutCircular(
  values: ReadonlyArray<SerializableValue>
): string {
  if (hasProhibitedEvent(values)) {
    throw createSerializationError(
      "Passing JS events to the server is prohibited. " +
      "Ensure you are not passing callbacks directly to DOM elements."
    );
  }

  return JSON.stringify(values, getCircularReplacer());
}

