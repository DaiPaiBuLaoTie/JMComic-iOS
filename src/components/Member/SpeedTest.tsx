import NetworkCheckOutlinedIcon from "@mui/icons-material/NetworkCheckOutlined";
import { CircularProgress } from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import GlobalStore from "../../config/GlobalStore";
import { getSpeedLevel, speedLevelStyle, testHostSpeedAndStore } from "../../utils/speedTestUtil";
type HostResult = {
  host: string;
  label: string;
  latency: number | null;
  downloadSpeed: number | null;
  // undefined：圖片還沒測過；null：測過但無法載入
  imageLoadTime: number | null | undefined;
};
type Usage = {
  date: string;
  count: number;
  lastTestAt: number;
};
type IpInfo = {
  ip: string;
  country: string;
};
const USAGE_STORAGE_KEY = "speedTestUsage";
const DAILY_LIMIT = 30;
const COOLDOWN_MS = 10_000;
const getTodayStr = () => new Date().toISOString().slice(0, 10);
const loadUsage = (): Usage => {
  try {
    const raw = JSON.parse(localStorage.getItem(USAGE_STORAGE_KEY) || "null");
    if (raw && raw.date === getTodayStr()) return raw;
  } catch {
    // ignore malformed storage
  }
  return {
    date: getTodayStr(),
    count: 0,
    lastTestAt: 0
  };
};
const SpeedTest = (props: any) => {
  const {
    setting
  } = props;
  const {
    t
  } = useTranslation();
  const [results, setResults] = useState<HostResult[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [usage, setUsage] = useState<Usage>(loadUsage);
  const [nowTick, setNowTick] = useState(Date.now());
  const [ipInfo, setIpInfo] = useState<IpInfo | null>(null);
  const currentHost = (() => {
    try {
      return GlobalStore.apiUrl ? new URL(GlobalStore.apiUrl).host : "";
    } catch {
      return "";
    }
  })();
  const currentResult = results.find(r => r.host === currentHost) ?? null;

  // FirstCover 選線畫面已經測過當前線路的延遲／吞吐量，第一次進來就先沿用顯示，不用整套重測
  useEffect(() => {
    if (!currentHost) return;
    const hosts: [string, string][] = GlobalStore.hostServer || [];
    const label = hosts.find(([host]) => host === currentHost)?.[1] ?? currentHost;
    if (!Object.prototype.hasOwnProperty.call(GlobalStore.lineLatency, label)) return;
    setResults([{
      host: currentHost,
      label,
      latency: GlobalStore.lineLatency[label],
      downloadSpeed: GlobalStore.lineDownloadSpeed[label] ?? null,
      imageLoadTime: GlobalStore.lineImageLoadTime[label]
    }]);
  }, [currentHost]);

  // 查詢公開 IP 資訊
  useEffect(() => {
    refreshIp();
  }, []);
  const refreshIp = async () => {
    // 強制走 IPv4 取得位址，再查國家
    const fetchIpData = async () => {
      const ipResponse = await fetch("https://api4.ipify.org?format=json");
      const {
        ip
      } = await ipResponse.json();
      const geoResponse = await fetch(`https://ipwho.is/${ip}`);
      const geoData = await geoResponse.json();
      return {
        ip,
        country: geoData.country_code
      };
    };
    try {
      setIpInfo(null); // 清空當前 IP 資訊，顯示查詢中
      const ipData = await fetchIpData(); // 第一次請求
      setIpInfo(ipData);
    } catch (error) {
      console.error("刷新 IP 失敗，嘗試重新獲取...", error);
      try {
        const retryIpData = await fetchIpData(); // 第二次請求
        setIpInfo(retryIpData);
      } catch (retryError) {
        console.error("再次刷新 IP 失敗:", retryError);
        setIpInfo({
          ip: "無法獲取",
          country: "未知"
        }); // 如果再次失敗，設置默認值
      }
    }
  };

  // 冷卻中用較短間隔更新，讓按鈕的倒數文字跟進度條動畫平滑
  useEffect(() => {
    if (COOLDOWN_MS - (Date.now() - usage.lastTestAt) <= 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setNowTick(now);
      if (now - usage.lastTestAt >= COOLDOWN_MS) clearInterval(timer);
    }, 100);
    return () => clearInterval(timer);
  }, [usage.lastTestAt]);

  // const hostList: [string, string][] = GlobalStore.hostServer || [];

  // const switchToHost = (host: string) => {
  //   GlobalStore.updateApiUrl(`https://${host}/`);
  //   window.location.reload();
  // };

  const cooldownElapsedMs = Math.min(COOLDOWN_MS, Math.max(0, nowTick - usage.lastTestAt));
  const remainingCooldownSec = Math.max(0, Math.ceil((COOLDOWN_MS - cooldownElapsedMs) / 1000));
  const limitReached = usage.count >= DAILY_LIMIT;
  const inCooldown = usage.lastTestAt > 0 && remainingCooldownSec > 0;
  const cooldownProgress = inCooldown ? cooldownElapsedMs / COOLDOWN_MS * 100 : 0;
  const handleSpeedTest = async () => {
    if (limitReached || inCooldown) return;
    if (!currentHost) return;
    setIsTesting(true);
    setResults([]);
    try {
      const hosts: [string, string][] = GlobalStore.hostServer || [];
      const currentLabel = hosts.find(([host]) => host === currentHost)?.[1] ?? currentHost;
      const testResult: HostResult = {
        host: currentHost,
        label: currentLabel,
        ...(await testHostSpeedAndStore(currentHost, currentLabel))
      };
      setResults([testResult]);
      setUsage(prev => {
        const today = getTodayStr();
        const next: Usage = {
          date: today,
          count: (prev.date === today ? prev.count : 0) + 1,
          lastTestAt: Date.now()
        };
        localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    } catch (error) {
      console.error("測速失敗:", error);
    } finally {
      setIsTesting(false);
    }
  };
  return <div className="w-full bg-gray-100 text-bbk dark:bg-bbk dark:text-tgy p-4 sm:p-6 md:p-10 flex items-start justify-center pb-40">
      <div className="w-full max-w-3xl rounded-lg bg-white dark:bg-bbk shadow-sm">
        <div className="flex flex-col gap-1 border-b border-gray-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <NetworkCheckOutlinedIcon className="text-gray-500 dark:text-gray-400" fontSize="small" aria-hidden="true" />
            <h1 className="text-xl font-semibold text-gray-800 dark:text-tgy">{t("member.speed_test_title")}</h1>
          </div>
        </div>

        <div className="flex flex-col gap-6 px-4 py-6 sm:px-6">
          <div>
            <p className="text-lg text-gray-500 dark:text-gray-400">{t("member.speed_test_current_ip")}</p>
            <p className="mt-1 text-lg text-gray-800 dark:text-tgy flex items-center">
              {ipInfo ? <>
                  {ipInfo.ip}
                  <span className="ml-2">{ipInfo.country}</span>
                  <button onClick={refreshIp} className="ml-6 text-white bg-og px-4 py-1 text-lg rounded-md">
                    {t("member.refresh_ip")}
                  </button>
                </> : t("member.speed_test_querying")}
            </p>
          </div>

          <div>
            <p className="text-lg text-gray-500 dark:text-gray-400">{t("member.speed_test_current_latency")}</p>
            <p className="mt-1 text-lg text-gray-800 dark:text-tgy">
              {isTesting ? t("member.speed_test_testing") : currentResult ? currentResult.latency === null ? t("member.speed_test_unreachable") : `${currentResult.latency.toFixed(0)} ms / ${currentResult.downloadSpeed !== null ? `${currentResult.downloadSpeed.toFixed(2)} Mbps` : "-"}` : t("member.speed_test_not_tested")}
            </p>
          </div>

          <div>
            <p className="text-lg text-gray-500 dark:text-gray-400">{t("member.speed_test_image_ready_time")}</p>
            <p className="mt-1 text-lg text-gray-800 dark:text-tgy">
              {isTesting ? t("member.speed_test_testing") : currentResult && currentResult.imageLoadTime !== undefined ? currentResult.imageLoadTime === null ? t("member.speed_test_image_load_fail") : `${currentResult.imageLoadTime.toFixed(0)} ms` : t("member.speed_test_not_tested")}
            </p>
          </div>

          <div>
            <p className="text-lg text-gray-500 dark:text-gray-400">{t("member.speed_test_current_quality")}</p>
            <p className={`mt-1 flex items-center gap-2 text-lg ${speedLevelStyle[getSpeedLevel(currentResult?.latency ?? null)].text}`}>
              {!isTesting && currentResult && <span className={`h-2.5 w-2.5 rounded-full ${speedLevelStyle[getSpeedLevel(currentResult.latency)].dot}`} />}
              {isTesting ? t("member.speed_test_testing") : currentResult ? {
              smooth: t("member.speed_test_smooth"),
              normal: t("member.speed_test_normal"),
              laggy: t("member.speed_test_laggy")
            }[getSpeedLevel(currentResult.latency)] : t("member.speed_test_not_tested")}
            </p>
            <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">
              {t("member.speed_test_legend_prefix")}{" "}
              <span className="text-green-500">{t("member.speed_test_legend_smooth")}</span>、
              <span className="text-orange-400">{t("member.speed_test_legend_normal")}</span>、
              <span className="text-red-500">{t("member.speed_test_legend_laggy")}</span>
              {t("member.speed_test_legend_suffix")}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 px-4 pb-6 sm:pb-8">
          <button type="button" onClick={handleSpeedTest} disabled={isTesting || limitReached || inCooldown} className="relative flex w-full max-w-xs items-center justify-center gap-2 overflow-hidden rounded-md bg-og px-6 py-2.5 text-lg font-medium text-white shadow-sm transition-colors duration-150 hover:bg-og active:bg-og focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70">
            {inCooldown && <span className="absolute inset-y-0 left-0 bg-white/25" style={{
            width: `${cooldownProgress}%`,
            transition: "width 100ms linear"
          }} />}
            <span className="relative flex items-center gap-2">
              {isTesting ? <CircularProgress size={18} sx={{
              color: "#fff"
            }} /> : limitReached ? t("member.speed_test_limit_reached_btn") : inCooldown ? t("member.speed_test_please_wait", {
              seconds: remainingCooldownSec
            }) : results.length > 0 ? t("member.speed_test_retest") : t("member.speed_test_start")}
            </span>
          </button>
          <span className="text-sm text-gray-400 dark:text-gray-500">
            {limitReached ? t("member.speed_test_limit_reached_hint", {
            limit: DAILY_LIMIT
          }) : t("member.speed_test_remaining_hint", {
            remaining: DAILY_LIMIT - usage.count
          })}
          </span>
        </div>
      </div>
    </div>;
};
export default SpeedTest;
