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

/**
 * Immutably adds an item to the end of an array.
 */
export function immutablePush<T>(
  arr: ReadonlyArray<T>,
  item: T
): ReadonlyArray<T> {
  return [...arr, item];
}

/**
 * Immutably removes an item at the specified index.
 * Returns the original array if index is out of bounds.
 */
export function immutableRemoveAt<T>(
  arr: ReadonlyArray<T>,
  index: number
): ReadonlyArray<T> {
  if (index < 0 || index >= arr.length) {
    return arr;
  }
  return [...arr.slice(0, index), ...arr.slice(index + 1)];
}

/**
 * Immutably removes the first item matching the predicate.
 * Returns the original array if no match is found.
 */
export function immutableRemoveFirst<T>(
  arr: ReadonlyArray<T>,
  predicate: (item: T) => boolean
): ReadonlyArray<T> {
  const index = arr.findIndex(predicate);
  if (index === -1) {
    return arr;
  }
  return immutableRemoveAt(arr, index);
}

/**
 * Immutably updates an item at the specified index.
 * Returns the original array if index is out of bounds.
 */
export function immutableUpdateAt<T>(
  arr: ReadonlyArray<T>,
  index: number,
  updater: (item: T) => T
): ReadonlyArray<T> {
  if (index < 0 || index >= arr.length) {
    return arr;
  }
  const item = arr[index];
  if (item === undefined) {
    return arr;
  }
  return [...arr.slice(0, index), updater(item), ...arr.slice(index + 1)];
}

/**
 * Finds an item and returns both the item and its index.
 * Returns undefined if no match is found.
 */
export function findWithIndex<T>(
  arr: ReadonlyArray<T>,
  predicate: (item: T) => boolean
): { readonly item: T; readonly index: number } | undefined {
  const index = arr.findIndex(predicate);
  if (index === -1) {
    return undefined;
  }
  const item = arr[index];
  if (item === undefined) {
    return undefined;
  }
  return { item, index };
}

/**
 * Immutably updates the first item matching the predicate.
 * Returns the original array if no match is found.
 */
export function immutableUpdateFirst<T>(
  arr: ReadonlyArray<T>,
  predicate: (item: T) => boolean,
  updater: (item: T) => T
): ReadonlyArray<T> {
  const found = findWithIndex(arr, predicate);
  if (!found) {
    return arr;
  }
  return immutableUpdateAt(arr, found.index, updater);
}

/**
 * Immutably replaces the first item matching the predicate with a new item.
 * Returns the original array if no match is found.
 */
export function immutableReplaceFirst<T>(
  arr: ReadonlyArray<T>,
  predicate: (item: T) => boolean,
  newItem: T
): ReadonlyArray<T> {
  return immutableUpdateFirst(arr, predicate, () => newItem);
}
