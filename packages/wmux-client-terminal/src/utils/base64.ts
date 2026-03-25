export const toBase64 = (data: Uint8Array): string =>
  Buffer.from(data).toString("base64");

export const fromBase64 = (data: string): Uint8Array =>
  new Uint8Array(Buffer.from(data, "base64"));
