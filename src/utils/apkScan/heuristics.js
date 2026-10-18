// String-level malware heuristics used by the in-app browser scanner
// (src/pages/TestComponent.tsx). Operates on an already decoded string so
// the caller can use TextDecoder('latin1') to decode dex bytes.

const DEX_FILE_RE = /^classes\d*\.dex$/;
const NATIVE_LIB_RE = /^lib\/.*\.so$/;

// Rough, string-level indicators that a component with device-locking /
// persistence / ad-fraud capability is present. These are *signals*, not
// proof — a legitimate app can reference some of these APIs too. Treat hits
// as "worth a human look", not a verdict.
const SUSPICIOUS_STRINGS = [{
  pattern: /DevicePolicyManager/,
  label: '设备管理员 API (可远程锁屏/抹除数据)',
  weight: 3
}, {
  pattern: /lockNow/,
  label: '调用 lockNow (强制锁屏)',
  weight: 3
}, {
  pattern: /wipeData/,
  label: '调用 wipeData (远程抹除数据)',
  weight: 4
}, {
  pattern: /resetPassword/,
  label: '调用 resetPassword (劫持锁屏密码)',
  weight: 4
}, {
  pattern: /AccessibilityService/,
  label: '无障碍服务 API (可用于自动点击/窃取界面内容)',
  weight: 2
}, {
  pattern: /BIND_DEVICE_ADMIN/,
  label: 'BIND_DEVICE_ADMIN 权限字符串',
  weight: 3
}, {
  pattern: /addSystemOverlay|TYPE_SYSTEM_ALERT|TYPE_ACCESSIBILITY_OVERLAY/,
  label: '系统悬浮窗相关 API',
  weight: 2
}, {
  pattern: /su\s+-c|Runtime\.getRuntime\(\)\.exec/,
  label: '尝试获取 root / 执行 shell 命令',
  weight: 2
}, {
  pattern: /DexClassLoader|loadDex|loadLibrary\(["']payload/,
  label: '动态加载额外的 dex/so (常见于二次打包投毒)',
  weight: 3
}, {
  pattern: /xposed|frida-server/,
  label: 'Hook 框架特征字符串',
  weight: 1
}];
function scanStringForHits(text) {
  const hits = [];
  for (const rule of SUSPICIOUS_STRINGS) {
    if (rule.pattern.test(text)) {
      hits.push({
        label: rule.label,
        weight: rule.weight
      });
    }
  }
  return hits;
}
module.exports = {
  DEX_FILE_RE,
  NATIVE_LIB_RE,
  SUSPICIOUS_STRINGS,
  scanStringForHits
};
