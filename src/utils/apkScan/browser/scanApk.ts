import { loadZip } from "./zip";
import { parseManifest } from "./manifest";
import { extractSignerCertificates, SignerInfo } from "./signature";
import { scanDexAndNativeLibs, HeuristicFinding } from "./heuristics";
import { sha256Hex } from "./hash";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  evaluate
} = require("../evaluate");
export interface ManifestInfo {
  packageId: string;
  versionName: string;
  versionCode: number;
  minSdkVersion: number | null;
  targetSdkVersion: number | null;
  permissions: string[];
  activities: string[];
  services: {
    name: string;
    exported: boolean;
    permission: string | null;
  }[];
  receivers: {
    name: string;
    exported: boolean;
    permission: string | null;
  }[];
  providers: string[];
}
export interface ApkScanResult {
  apkName: string;
  apkSha256: string;
  manifest: ManifestInfo;
  signers: SignerInfo[];
  heuristicHits: HeuristicFinding[];
}
export interface Finding {
  level: "CRITICAL" | "WARN" | "INFO" | "OK";
  message: string;
}
export interface EvaluateResult {
  findings: Finding[];
  severity: 0 | 1 | 2;
  verdict: "NO_BASELINE" | "OFFICIAL_LIKE" | "SUSPICIOUS" | "LIKELY_TAMPERED";
}
export async function scanApkFile(file: File): Promise<ApkScanResult> {
  const [apkSha256, zip] = await Promise.all([file.arrayBuffer().then(sha256Hex), loadZip(file)]);
  const manifest = await parseManifest(zip);
  const signers = await extractSignerCertificates(zip);
  const {
    findings: heuristicHits
  } = await scanDexAndNativeLibs(zip);
  return {
    apkName: file.name,
    apkSha256,
    manifest,
    signers,
    heuristicHits
  };
}
export function evaluateApkScan(scan: ApkScanResult, baseline: unknown): EvaluateResult {
  return evaluate(scan, baseline);
}
