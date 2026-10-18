export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const buf = data instanceof Uint8Array ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) : data;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}
