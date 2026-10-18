import forge from "node-forge";
import JSZip from "jszip";
import { findEntries, readEntryBytes } from "./zip";
export interface SignerInfo {
  file: string;
  subject?: string;
  sha256?: string;
  notBefore?: Date;
  notAfter?: Date;
  error?: string;
}
const SIGNER_FILE_RE = /^META-INF\/.*\.(RSA|DSA|EC)$/i;
function fingerprintDer(der: string): string {
  const md = forge.md.sha256.create();
  md.update(der);
  return md.digest().toHex().toUpperCase().replace(/(.{2})(?=.)/g, "$1:");
}

/**
 * Extracts v1 (JAR) signing certificates from META-INF/*.{RSA,DSA,EC}. Many
 * repackaged APKs are re-signed with v1 so this is a reliable identity
 * signal even when the original v2/v3 signing block has been stripped.
 */
export async function extractSignerCertificates(zip: JSZip): Promise<SignerInfo[]> {
  const sigFiles = findEntries(zip, SIGNER_FILE_RE);
  const signers: SignerInfo[] = [];
  for (const name of sigFiles) {
    const bytes = await readEntryBytes(zip, name);
    try {
      const binaryString = forge.util.binary.raw.encode(bytes);
      const asn1 = forge.asn1.fromDer(forge.util.createBuffer(binaryString));
      const p7 = forge.pkcs7.messageFromAsn1(asn1) as forge.pkcs7.PkcsSignedData;
      for (const cert of p7.certificates) {
        const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
        signers.push({
          file: name,
          subject: cert.subject.attributes.map(a => `${a.shortName}=${a.value}`).join(", "),
          sha256: fingerprintDer(der),
          notBefore: cert.validity.notBefore,
          notAfter: cert.validity.notAfter
        });
      }
    } catch (e: any) {
      signers.push({
        file: name,
        error: `无法解析签名证书: ${e.message}`
      });
    }
  }
  return signers;
}
