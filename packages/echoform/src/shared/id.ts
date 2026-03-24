/**
 * Generates a cryptographically strong random ID using crypto.randomUUID().
 */
export function randomId(): string {
  return globalThis.crypto.randomUUID();
}
