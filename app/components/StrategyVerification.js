import {Info, ShieldCheck} from 'lucide-react';
import {Badge} from './ui/UiKit';
import {displayDate, verificationDisplay} from '@/lib/strategy-display.mjs';

export default function StrategyVerification({verification,t}) {
  const state=verificationDisplay(verification,t);
  const observation=verification?.evidence;
  return <div className="strategy-verification rounded-xl border border-slate-700/60 p-4">
    <div className="flex flex-wrap items-center gap-2"><ShieldCheck aria-hidden="true" className="h-5 w-5 text-cyan-300"/><Badge variant={state.variant}>{state.label}</Badge>{state.statusLabel&&<Badge variant={state.variant}>{state.statusLabel}</Badge>}</div>
    <p className="mt-3 text-sm leading-7 text-slate-300">{state.description}</p>
    <dl className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2"><div><dt className="inline">{t('验证时间','Verified')}: </dt><dd className="inline">{displayDate(verification?.verifiedAt,t)}</dd></div><div><dt className="inline">{t('有效期至','Valid until')}: </dt><dd className="inline">{verification?.expiresAt?displayDate(verification.expiresAt,t):t('未设置到期日','No expiry date recorded')}</dd></div></dl>
    {state.level==='live_verified'&&<p className="mt-2 break-words text-sm text-slate-300">{observation?.provider||t('来源未披露','Provider not disclosed')} · {observation?.accountMasked||t('账户未披露','Account not disclosed')} · {observation?.observedDays??'—'} {t('天只读观察','days read-only observation')}</p>}
    <p className="mt-3 flex items-start gap-2 text-xs leading-6 text-slate-400"><Info aria-hidden="true" className="mt-1 h-4 w-4 shrink-0"/>{t('认证仅说明证据范围，不构成收益承诺；请同时核对报告、环境与日期。','Verification describes evidence scope, not promised returns. Review the report, environment and dates together.')}</p>
  </div>;
}
