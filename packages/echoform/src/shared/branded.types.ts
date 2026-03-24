/**
 * Branded types for maximum type safety.
 * Prevents accidental mixing of string identifiers.
 */

declare const __brand: unique symbol;

type Brand<T, B extends string> = T & { readonly [__brand]: B };

// Core branded types for identifiers
export type EventUid = Brand<string, 'EventUid'>;
export type RequestUid = Brand<string, 'RequestUid'>;
export type ViewUid = Brand<string, 'ViewUid'>;
export type PropName = Brand<string, 'PropName'>;
export type StreamUid = Brand<string, 'StreamUid'>;

// Generic branded type factory
function brand<T extends string>(value: string): Brand<string, T> {
  return value as Brand<string, T>;
}

// Factory functions to create branded types
export const createEventUid = (value: string): EventUid => brand<'EventUid'>(value);
export const createRequestUid = (value: string): RequestUid => brand<'RequestUid'>(value);
export const createViewUid = (value: string): ViewUid => brand<'ViewUid'>(value);
export const createPropName = (value: string): PropName => brand<'PropName'>(value);
export const createStreamUid = (value: string): StreamUid => brand<'StreamUid'>(value);
