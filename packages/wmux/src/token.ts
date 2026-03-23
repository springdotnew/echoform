export function generateToken(): string {
  return globalThis.crypto.randomUUID();
}

export function createTokenValidator(token: string): (candidate: string) => boolean {
  return (candidate) => candidate === token;
}
