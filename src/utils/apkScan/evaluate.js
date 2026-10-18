// "Diff against the official baseline" logic used by the in-app browser
// scanner (src/pages/TestComponent.tsx). Pure: no fs, no network, just
// object comparisons.

const HIGH_RISK_PERMISSIONS = ['android.permission.BIND_DEVICE_ADMIN', 'android.permission.BIND_ACCESSIBILITY_SERVICE', 'android.permission.SYSTEM_ALERT_WINDOW', 'android.permission.REQUEST_INSTALL_PACKAGES', 'android.permission.QUERY_ALL_PACKAGES', 'android.permission.RECEIVE_BOOT_COMPLETED', 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE', 'android.permission.PACKAGE_USAGE_STATS'];
function diffComponents(known, found, kind) {
  const knownSet = new Set(known || []);
  return found.filter(name => !knownSet.has(name)).map(name => ({
    kind,
    name
  }));
}
function evaluate(scan, baseline) {
  const findings = [];
  let severity = 0; // 0 ok, 1 suspicious, 2 malicious-likely

  if (!baseline) {
    findings.push({
      level: 'INFO',
      message: '未找到基线文件，无法比对。请先用一个确认可信的官方签名 APK 生成基线。'
    });
    return {
      findings,
      severity: 0,
      verdict: 'NO_BASELINE'
    };
  }
  if (scan.manifest.packageId !== baseline.packageId) {
    severity = Math.max(severity, 2);
    findings.push({
      level: 'CRITICAL',
      message: `包名(applicationId)不一致: 实际 "${scan.manifest.packageId}"，官方应为 "${baseline.packageId}"。这不是官方发行的包。`
    });
  }
  const signerFingerprints = scan.signers.filter(s => s.sha256).map(s => s.sha256);
  const knownFps = new Set(baseline.signerFingerprints || []);
  const hasKnownSigner = signerFingerprints.some(fp => knownFps.has(fp));
  if (signerFingerprints.length === 0) {
    severity = Math.max(severity, 2);
    findings.push({
      level: 'CRITICAL',
      message: '未能提取到任何签名证书，APK 可能损坏或签名信息被破坏。'
    });
  } else if (!hasKnownSigner) {
    severity = Math.max(severity, 2);
    findings.push({
      level: 'CRITICAL',
      message: `签名证书与官方不一致 (${signerFingerprints.join(', ')})，APK 已被他人重新签名 —— 几乎可以确定是二次打包/篡改版本。`
    });
  } else {
    findings.push({
      level: 'OK',
      message: '签名证书与官方一致。'
    });
  }
  const newServices = diffComponents(baseline.knownServices, scan.manifest.services.map(s => s.name), 'service');
  const newReceivers = diffComponents(baseline.knownReceivers, scan.manifest.receivers.map(r => r.name), 'receiver');
  const newProviders = diffComponents(baseline.knownProviders, scan.manifest.providers, 'provider');
  for (const item of [...newServices, ...newReceivers, ...newProviders]) {
    severity = Math.max(severity, 2);
    findings.push({
      level: 'CRITICAL',
      message: `发现官方清单中不存在的组件: <${item.kind}> ${item.name}。这正是用户反馈"携带未知 SystemService"类问题的典型信号。`
    });
  }
  const newPermissions = diffComponents(baseline.knownPermissions, scan.manifest.permissions, 'permission');
  for (const item of newPermissions) {
    const isHighRisk = HIGH_RISK_PERMISSIONS.includes(item.name);
    severity = Math.max(severity, isHighRisk ? 2 : 1);
    findings.push({
      level: isHighRisk ? 'CRITICAL' : 'WARN',
      message: `发现官方版本未声明的权限: ${item.name}${isHighRisk ? ' (高危权限，常被设备锁定/流氓软件滥用)' : ''}`
    });
  }
  for (const heur of scan.heuristicHits || []) {
    for (const hit of heur.hits) {
      severity = Math.max(severity, hit.weight >= 3 ? 2 : 1);
      findings.push({
        level: hit.weight >= 3 ? 'WARN' : 'INFO',
        message: `${heur.file} 中发现可疑特征: ${hit.label}`
      });
    }
  }
  if (severity === 0) {
    findings.push({
      level: 'OK',
      message: '清单结构、权限、签名均与官方基线一致，未发现异常。'
    });
  }
  const verdict = severity === 2 ? 'LIKELY_TAMPERED' : severity === 1 ? 'SUSPICIOUS' : 'OFFICIAL_LIKE';
  return {
    findings,
    severity,
    verdict
  };
}
module.exports = {
  HIGH_RISK_PERMISSIONS,
  diffComponents,
  evaluate
};
