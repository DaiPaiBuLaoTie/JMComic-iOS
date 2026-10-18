import { Buffer } from "buffer";
import JSZip from "jszip";
import { findEntries, readEntryBytes } from "./zip";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  normalizeManifest
} = require("../manifest");
const MANIFEST_NAME_RE = /^androidmanifest\.xml$/i;
export async function parseManifest(zip: JSZip) {
  const [entryName] = findEntries(zip, MANIFEST_NAME_RE);
  if (!entryName) {
    throw new Error("APK 中找不到 AndroidManifest.xml，文件可能损坏。");
  }
  const bytes = await readEntryBytes(zip, entryName);
  const buffer = Buffer.from(bytes);
  return normalizeManifest(buffer);
}
