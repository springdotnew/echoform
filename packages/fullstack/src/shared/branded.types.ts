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

// Factory functions to create branded types
export function createEventUid(value: string): EventUid {
  return value as EventUid;
}

export function createRequestUid(value: string): RequestUid {
  return value as RequestUid;
}

export function createViewUid(value: string): ViewUid {
  return value as ViewUid;
}

export function createPropName(value: string): PropName {
  return value as PropName;
}

export function createStreamUid(value: string): StreamUid {
  return value as StreamUid;
}
