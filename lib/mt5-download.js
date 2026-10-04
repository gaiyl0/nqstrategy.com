export const MT5_PACKAGE = Object.freeze({
  url: '/downloads/tmgm-mt5-windows-x64-build6230.zip',
  label: '下载 TMGM MT5（Windows）',
  description: 'Windows 64 位解压运行包，含客户端、MetaEditor 和策略测试器。完整解压后启动，首次运行可能联网初始化或更新。',
  version: 'Build 6230',
  bytes: 125631858,
  sha256: 'dc2c47cb32c3a69aed891218dfcb4ae6799745623cfa8b13dd4a9af428706053',
});

export function isSafeMt5DownloadUrl(value) {
  if (/^\/downloads\/[A-Za-z0-9][A-Za-z0-9._-]*\.zip$/.test(value) && !value.includes('..')) return true;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}

export function resolveMt5Download(settings = {}) {
  if (settings?.mt5DownloadEnabled === false) return null;
  const url = settings?.mt5DownloadUrl ?? MT5_PACKAGE.url;
  if (!isSafeMt5DownloadUrl(url)) return null;
  const isLocalPackage = url === MT5_PACKAGE.url;
  return { ...(isLocalPackage ? MT5_PACKAGE : {}), url, label: settings?.mt5DownloadLabel || MT5_PACKAGE.label, description: settings?.mt5DownloadDescription || MT5_PACKAGE.description };
}
