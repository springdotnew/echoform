export function toBase64(data: Uint8Array): string {
  let binaryString = "";
  for (let i = 0; i < data.length; i++) binaryString += String.fromCharCode(data[i]!);
  return btoa(binaryString);
}

export function fromBase64(b64: string): Uint8Array {
  const decoded = atob(b64);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
  return bytes;
}
