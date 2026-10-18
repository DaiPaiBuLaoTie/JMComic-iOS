export const updatePolicy = Object.freeze({ mode: 'bundled-only', remoteCode: false });

const blockedPaths = new Set(['ad_content_all', 'advertise_all', 'advertise', 'ad_content']);
const trackingHosts = ['clarity.ms', 'google-analytics.com', 'googletagmanager.com'];

export function isBlockedRequest(input: string, base = 'http://localhost'): boolean {
  const url = new URL(input, base);
  const finalSegment = url.pathname.split('/').filter(Boolean).pop() || '';
  return blockedPaths.has(finalSegment) || /\/static\/jmapp3apk\//i.test(url.pathname)
    || /\/(?:build\.(?:enc|zip)|version\.txt)$/i.test(url.pathname)
    || trackingHosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
}

export function clearLegacyCodeCache(storage: Storage): void {
  for (const key of ['adsList', 'adsContent', 'oldAdsCache', 'adsIpcountry', 'hotVersion', 'localVersion']) {
    storage.removeItem(key);
  }
}
