import JSZip from "jszip";
export async function loadZip(file: File | Blob) {
  return JSZip.loadAsync(file);
}
export function findEntries(zip: JSZip, pattern: RegExp) {
  return Object.keys(zip.files).filter(name => pattern.test(name));
}
export async function readEntryBytes(zip: JSZip, name: string): Promise<Uint8Array> {
  const entry = zip.files[name];
  if (!entry) throw new Error(`Zip entry not found: ${name}`);
  return entry.async("uint8array");
}
