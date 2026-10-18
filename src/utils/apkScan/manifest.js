const ManifestParser = require('./axml/manifestParser');

/**
 * @param {Buffer} buffer - raw bytes of AndroidManifest.xml (binary AXML format).
 *   Works with Node's built-in Buffer or the `buffer` npm polyfill in the browser —
 *   both implement the same readUInt32LE/slice/toString API that the vendored
 *   AXML parser relies on.
 */
function normalizeManifest(buffer) {
  const parser = new ManifestParser(buffer);
  const info = parser.parse();
  const app = info.application || {};
  return {
    packageId: info.package,
    versionName: info.versionName,
    versionCode: info.versionCode,
    minSdkVersion: info.usesSdk ? info.usesSdk.minSdkVersion : null,
    targetSdkVersion: info.usesSdk ? info.usesSdk.targetSdkVersion : null,
    permissions: (info.usesPermissions || []).map(p => p.name).filter(Boolean),
    activities: (app.activities || []).map(a => a.name).filter(Boolean),
    services: (app.services || []).map(s => ({
      name: s.name,
      exported: s.exported !== false,
      permission: s.permission || null
    })),
    receivers: (app.receivers || []).map(r => ({
      name: r.name,
      exported: r.exported !== false,
      permission: r.permission || null
    })),
    providers: (app.providers || []).map(p => p.name).filter(Boolean)
  };
}
module.exports = {
  normalizeManifest
};
