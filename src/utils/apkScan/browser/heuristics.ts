import JSZip from "jszip";
import { findEntries, readEntryBytes } from "./zip";
import { sha256Hex } from "./hash";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  DEX_FILE_RE,
  NATIVE_LIB_RE,
  scanStringForHits
} = require("../heuristics");
export interface HeuristicFinding {
  file: string;
  hits: {
    label: string;
    weight: number;
  }[];
}
export interface FileHash {
  file: string;
  sha256: string;
  size: number;
}
const latin1Decoder = new TextDecoder("latin1");
export async function scanDexAndNativeLibs(zip: JSZip): Promise<{
  findings: HeuristicFinding[];
  hashes: FileHash[];
}> {
  const targets = [...findEntries(zip, DEX_FILE_RE), ...findEntries(zip, NATIVE_LIB_RE)];
  const findings: HeuristicFinding[] = [];
  const hashes: FileHash[] = [];
  for (const name of targets) {
    const bytes = await readEntryBytes(zip, name);
    const sha256 = await sha256Hex(bytes);
    hashes.push({
      file: name,
      sha256,
      size: bytes.length
    });
    if (/\.dex$/.test(name)) {
      const text = latin1Decoder.decode(bytes);
      const hits = scanStringForHits(text);
      if (hits.length) {
        findings.push({
          file: name,
          hits
        });
      }
    }
  }
  return {
    findings,
    hashes
  };
}
