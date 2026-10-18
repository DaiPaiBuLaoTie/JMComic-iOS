import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { clearLegacyCodeCache, isBlockedRequest } from './policy';

clearLegacyCodeCache(localStorage);
const originalFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = input instanceof Request ? input.url : String(input);
  if (isBlockedRequest(url, location.href)) {
    throw new Error('此版本不加载广告、统计脚本或远程应用代码。');
  }
  return originalFetch(input, init);
};

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (const registration of registrations) void registration.unregister();
  }).catch(console.warn);
}

// Preserve the original download button while handing its file to iOS's save/share sheet.
document.addEventListener('click', event => {
  const anchor = (event.target as Element | null)?.closest?.('a[download]') as HTMLAnchorElement | null;
  if (!anchor || !Capacitor.isNativePlatform()) return;
  event.preventDefault();
  const response = window.fetch(anchor.href);
  const filename = (anchor.download || 'JMComic-download.zip').replace(/[\\/:*?"<>|]/g, '_');
  void (async () => {
    const blob = await (await response).blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.readAsDataURL(blob);
    });
    const file = await Filesystem.writeFile({ path: `exports/${Date.now()}-${filename}`, data: base64,
      directory: Directory.Cache, recursive: true });
    try {
      await Share.share({ title: filename, url: file.uri });
    } finally {
      await Filesystem.deleteFile({ path: file.uri }).catch(console.warn);
    }
  })().catch(error => window.alert(`文件导出失败：${error.message}`));
}, true);
