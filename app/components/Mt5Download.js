import { Download } from 'lucide-react';
import { resolveMt5Download, MT5_PACKAGE } from '@/lib/mt5-download';

export function Mt5DownloadLink({ settings, t = zh => zh, className = '' }) {
  const download = resolveMt5Download(settings);
  if (!download) return null;
  return <a href={download.url} className={`mt5-download-link ${className}`} download={download.url.startsWith('/downloads/') ? true : undefined} target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4 shrink-0" aria-hidden="true"/><span className="mt5-download-label">{t(download.label, download.label === MT5_PACKAGE.label ? 'Download MT5 (Windows)' : download.label)}</span><span aria-hidden="true">↗</span></a>;
}

export default function Mt5DownloadPanel({ settings }) {
  const download = resolveMt5Download(settings);
  if (!download) return null;
  return <section id="mt5-download" className="mt5-download-panel topic-guide-section rounded-xl border border-slate-700 bg-slate-900/65 p-5 sm:p-7"><p className="text-sm font-semibold text-cyan-300">MT5 · Windows x64</p><h2 className="mt-2 text-xl font-bold text-white">下载与启动 MT5</h2><p className="mt-4 text-base leading-8 text-slate-300">{download.description}</p><div className="mt-4 flex flex-wrap items-center gap-3"><Mt5DownloadLink settings={settings}/>{download.version && <span className="text-sm text-slate-400">{download.version} · {(download.bytes / 1024 / 1024).toFixed(1)} MiB · ZIP</span>}</div>{download.version ? <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm leading-7 text-slate-300"><li>Windows 64 位：完整解压到可写目录，再运行 Start-MT5.cmd；不要在压缩包内直接启动。</li><li>使用您自己的 MT5 账户，选择交易平台提供的正确服务器。此包不包含登录信息、个人 EA 或交易历史。</li><li>导入 EA：在 MT5 中选择“文件 → 打开数据文件夹”，将 EX5 放入 MQL5/Experts，再刷新导航器。</li></ol> : <p className="mt-5 text-sm leading-7 text-slate-300">请按下载来源的安装说明操作，使用您自己的 MT5 账户并选择正确的交易服务器。</p>}{download.sha256 && <details className="mt-4 text-sm text-slate-400"><summary className="cursor-pointer py-2">查看文件 SHA-256 校验值</summary><code className="mt-2 block break-all rounded-lg bg-slate-950/30 p-3">{download.sha256}</code></details>}<a href="https://www.tmgm.com/zh-hant/platform/metatrader-5" target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center text-sm text-cyan-300">TMGM 官方下载及其他设备版本 ↗</a>{download.version && <p className="mt-2 text-sm leading-7 text-slate-400">本包从已安装客户端整理，保留程序原文件，并非官方安装向导。软件版权属于原开发商；下载不等于平台开户或 EA 授权。</p>}</section>;
}
