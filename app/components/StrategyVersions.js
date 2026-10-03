import {displayDate,upgradeLabel} from '@/lib/strategy-display.mjs';

export default function StrategyVersions({versions=[],t}) {
  const published=versions.filter(version=>!version.status || version.status==='published');
  if(!published.length)return <p className="text-sm leading-7 text-slate-400">{t('暂无公开版本记录；可下载版本与授权资格以个人中心实际记录为准。','No public version records. Available downloads and eligibility follow the records in your profile.')}</p>;
  return <div className="divide-y divide-slate-700/50">{published.map(version=><article key={version.id} className="py-4 first:pt-0 last:pb-0"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-base font-bold text-white">v{version.version||t('未披露','Not disclosed')}{version.isCurrent?` · ${t('当前版本','Current')}`:''}</h3><span className="text-xs text-slate-400">{displayDate(version.releasedAt||version.createdAt,t)}</span></div><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-300">{version.releaseNotes||t('未提供版本说明','No release notes provided')}</p><p className="mt-2 text-xs leading-6 text-slate-400">{upgradeLabel(version.upgradePolicy,t)}</p><p className="mt-1 break-all text-xs text-slate-400">SHA-256 {version.sha256?`${version.sha256.slice(0,16)}…`:t('未披露','Not disclosed')}</p></article>)}</div>;
}
