import React, { useRef, useState } from "react";
import apkScanBaseline from "../data/apkScanBaseline.json";
import { sha256Hex } from "../utils/apkScan/browser/hash";
import { ApkScanResult, EvaluateResult, evaluateApkScan, scanApkFile } from "../utils/apkScan/browser/scanApk";
const ACCESS_PASSWORD_HASH = "A0CE5CDFF91E736D0AA72B18FEA05F192E0D6024F5E9F1E9C2BBD12DEC71A9BC";
const UNLOCK_STORAGE_KEY = "apkScanUnlocked";
const LEVEL_STYLE: Record<string, {
  label: string;
  className: string;
}> = {
  CRITICAL: {
    label: "🔴 严重",
    className: "text-red-600 dark:text-red-400"
  },
  WARN: {
    label: "🟡 警告",
    className: "text-yellow-600 dark:text-yellow-400"
  },
  INFO: {
    label: "ℹ️ 提示",
    className: "text-sky-600 dark:text-sky-400"
  },
  OK: {
    label: "✅ 正常",
    className: "text-green-600 dark:text-green-400"
  }
};
const VERDICT_STYLE: Record<string, {
  label: string;
  className: string;
}> = {
  OFFICIAL_LIKE: {
    label: "✅ 与官方版本一致",
    className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
  },
  SUSPICIOUS: {
    label: "🟡 存在可疑差异，建议人工复核",
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
  },
  LIKELY_TAMPERED: {
    label: "🔴 高度疑似被篡改/二次打包，建议卸载并避免再次打开",
    className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
  },
  NO_BASELINE: {
    label: "ℹ️ 缺少基线，无法判断",
    className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
  }
};
const ApkSecurityCheck = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>("");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scan, setScan] = useState<ApkScanResult | null>(null);
  const [result, setResult] = useState<EvaluateResult | null>(null);
  const [unlocked, setUnlocked] = useState(() => localStorage.getItem(UNLOCK_STORAGE_KEY) === "1");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState(false);
  const [checkingPassword, setCheckingPassword] = useState(false);
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckingPassword(true);
    try {
      const hash = await sha256Hex(new TextEncoder().encode(password));
      if (hash.toUpperCase() === ACCESS_PASSWORD_HASH) {
        localStorage.setItem(UNLOCK_STORAGE_KEY, "1");
        setUnlocked(true);
        setAuthError(false);
      } else {
        setAuthError(true);
      }
    } finally {
      setCheckingPassword(false);
    }
  };
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setScanning(true);
    setError(null);
    setScan(null);
    setResult(null);
    try {
      const scanResult = await scanApkFile(file);
      const evaluated = evaluateApkScan(scanResult, apkScanBaseline);
      setScan(scanResult);
      setResult(evaluated);
    } catch (err: any) {
      setError(err?.message || "解析失败，文件可能不是有效的 APK。");
    } finally {
      setScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };
  if (!unlocked) {
    return <div className="min-h-full bg-white dark:bg-bbk text-black dark:text-white px-4 py-8 pt-[calc(env(safe-area-inset-top)+32px)]">
        <form onSubmit={handleUnlock} className="max-w-sm">
          <h1 className="text-xl font-bold mb-4">需要密码</h1>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="请输入密码" autoFocus className="w-full px-4 py-3 rounded-lg border border-gy/30 bg-transparent text-base mb-3 focus:outline-none focus:border-og" />
          {authError && <p className="text-base text-red-600 dark:text-red-400 mb-3">密码错误</p>}
          <button type="submit" disabled={checkingPassword || !password} className="px-6 py-3 rounded-lg bg-og text-white text-lg font-medium disabled:opacity-50">
            {checkingPassword ? "验证中…" : "进入"}
          </button>
        </form>
      </div>;
  }
  return <div className="min-h-full bg-white dark:bg-bbk text-black dark:text-white px-4 py-8 pt-[calc(env(safe-area-inset-top)+32px)]">
      <h1 className="text-2xl font-bold mb-3">APK 安全检测</h1>
      <p className="text-base leading-relaxed text-gy dark:text-tgy mb-6">
        用于排查"下载到的 APK 携带未知 SystemService 导致手机异常"类问题。选择一个 APK 文件，与官方签名/清单基线比对，
        判断它是否是被二次打包的假冒版本。
      </p>

      <details className="mb-6 text-base leading-relaxed text-gy dark:text-tgy border border-gy/30 rounded-lg px-4 py-3">
        <summary className="cursor-pointer font-medium text-black dark:text-white text-lg">本工具检测了什么？</summary>
        <ul className="mt-3 space-y-3 list-disc pl-5">
          <li>
            <span className="font-medium text-black dark:text-white">签名证书比对</span> —
            二次打包必然要用别人的证书重新签名，证书指纹跟官方不一致就直接判定异常，跟文件名、包里东西叫什么无关。
          </li>
          <li>
            <span className="font-medium text-black dark:text-white">包名一致性</span> — applicationId
            是否与官方发布的一致。
          </li>
          <li>
            <span className="font-medium text-black dark:text-white">组件/权限异常扫描</span> — 官方版本没有任何
            Service，清单里只要多出一个 Service/Receiver/Provider（不论叫什么名字），或者多出
            设备管理员/无障碍服务/悬浮窗等高危权限，都会被标出来。
          </li>
          <li>
            <span className="font-medium text-black dark:text-white">可疑 API 调用扫描</span> — 在 dex 代码里找
            DevicePolicyManager / lockNow / wipeData / AccessibilityService 等跟锁屏、抹机、无障碍自动点击相关的系统 API
            调用痕迹。改类名、改服务名不会改变调用的是哪个系统 API，所以这条也绕不过去。
          </li>
        </ul>
        <p className="mt-3 text-sm leading-relaxed">
          注意：以上都是启发式比对，不是查询真正的病毒特征库（如
          VirusTotal）。结果只能说明"这包是否被动过手脚、有没有可疑行为痕迹"，不能 100% 断言"有没有病毒"。
        </p>
      </details>

      <input ref={fileInputRef} type="file" accept=".apk" onChange={handleFileChange} className="hidden" id="apk-file-input" />
      <label htmlFor="apk-file-input" className="inline-block px-6 py-3 rounded-lg bg-og text-white text-lg font-medium cursor-pointer active:opacity-80">
        选择 APK 文件
      </label>
      {fileName && <span className="ml-3 text-base text-gy dark:text-tgy align-middle">{fileName}</span>}

      {scanning && <p className="mt-6 text-base text-gy dark:text-tgy">正在解析，请稍候…</p>}

      {error && <p className="mt-6 text-base text-red-600 dark:text-red-400">{error}</p>}

      {scan && result && <div className="mt-6">
          <div className={`rounded-lg px-4 py-3 text-lg font-medium mb-4 ${VERDICT_STYLE[result.verdict]?.className ?? ""}`}>
            判定: {VERDICT_STYLE[result.verdict]?.label ?? result.verdict}
          </div>

          <div className="text-base leading-relaxed space-y-1 mb-4 text-gy dark:text-tgy break-all">
            <p>SHA256: {scan.apkSha256}</p>
            <p>
              包名: {scan.manifest.packageId} 版本: {scan.manifest.versionName} ({scan.manifest.versionCode})
            </p>
            <p>
              minSdk: {scan.manifest.minSdkVersion} targetSdk: {scan.manifest.targetSdkVersion}
            </p>
          </div>

          <ul className="space-y-3">
            {result.findings.map((f, i) => <li key={i} className={`text-base leading-relaxed ${LEVEL_STYLE[f.level]?.className ?? ""}`}>
                [{LEVEL_STYLE[f.level]?.label ?? f.level}] {f.message}
              </li>)}
          </ul>
        </div>}
    </div>;
};
export default ApkSecurityCheck;
