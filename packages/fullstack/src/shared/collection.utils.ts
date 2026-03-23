/**
 * Immutable collection utilities.
 * All functions return new arrays/objects without mutating inputs.
 */

/**
 * Returns undefined if the array is empty, otherwise returns the array.
 * Useful for optional array fields in serialization.
 */
export function nullIfEmpty<T>(
  arr: ReadonlyArray<T>
): ReadonlyArray<T> | undefined {
  return arr.length === 0 ? undefined : arr;
}
