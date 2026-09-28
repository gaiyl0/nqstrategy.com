"use client";

import React from 'react';
import Image from 'next/image';
import { Activity, BarChart3, Info, TrendingDown, TrendingUp } from 'lucide-react';

function number(value, digits = 2) {
  return Number(value).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function LineChart({ points, valueKey, color, suffix = '', t }) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const values = points.map((point) => Number(point[valueKey]));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const path = points.map((point, index) => {
    const x = (index / (points.length - 1)) * 100;
    const y = 92 - ((Number(point[valueKey]) - min) / range) * 82;
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');
  const first = points[0];
  const last = points.at(-1);

  return (
    <div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-44 rounded-xl bg-zinc-950 border border-zinc-800 p-2" role="img" aria-label={t('策略历史曲线', 'Strategy history chart')}>
        <line x1="0" y1="92" x2="100" y2="92" stroke="#27272a" strokeWidth="0.6" />
        <line x1="0" y1="51" x2="100" y2="51" stroke="#27272a" strokeWidth="0.4" strokeDasharray="2 2" />
        <path d={path} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-2 flex justify-between text-[10px] text-zinc-600">
        <span>{first.date}</span>
        <span>{number(min)}{suffix} – {number(max)}{suffix}</span>
        <span>{last.date}</span>
      </div>
    </div>
  );
}

function MonthlyBars({ points, t }) {
  const maxAbs = Math.max(1, ...points.map((point) => Math.abs(Number(point.percent))));
  return (
    <div className="overflow-x-auto custom-scrollbar">
      <div className="flex h-48 min-w-max items-center gap-2 border-b border-zinc-800 px-2 pt-3">
        {points.map((point) => {
          const positive = Number(point.percent) >= 0;
          const height = Math.max(8, (Math.abs(Number(point.percent)) / maxAbs) * 105);
          return (
            <div key={point.month} className="flex h-full w-14 shrink-0 flex-col items-center justify-end gap-2">
              <span className={`text-[10px] font-bold ${positive ? 'text-emerald-400' : 'text-red-400'}`}>{positive ? '+' : ''}{number(point.percent)}%</span>
              <div className={`w-7 rounded-t ${positive ? 'bg-emerald-500/70' : 'bg-red-500/70'}`} style={{ height }} title={`${point.month}: ${point.percent}%`} />
              <span className="pb-2 text-[10px] text-zinc-600">{point.month}</span>
            </div>
          );
        })}
      </div>
      <div className="sr-only">{t('月度收益柱状图', 'Monthly returns bar chart')}</div>
    </div>
  );
}

export default function StrategyMetrics({ metrics, evidence = [], report = null, verification = null, versions = [], t }) {
  if (!metrics) {
    return (
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 text-sm text-amber-300">
        <div className="flex items-center gap-2 font-bold"><Info className="h-4 w-4" />{t('旧版策略尚未补交结构化回测数据', 'Legacy strategy has no structured backtest data')}</div>
        <p className="mt-2 text-xs leading-relaxed text-amber-200/60">{t('页面中的旧胜率和回撤仅为历史文本，不能用于量化比较。开发者重新编辑后必须提交完整指标并重新审核。', 'Legacy win-rate and drawdown values are historical text and cannot be used for quantitative comparison. A new review is required after editing.')}</p>
      </div>
    );
  }

  const cards = [
    [t('初始资金', 'Initial Deposit'), `$${number(metrics.initialDeposit)}`],
    [t('净利润', 'Net Profit'), `${Number(metrics.netProfit) >= 0 ? '+' : '-'}$${number(Math.abs(metrics.netProfit))}`],
    ['Profit Factor', number(metrics.profitFactor)],
    ['Sharpe Ratio', number(metrics.sharpeRatio)],
    [t('最大回撤', 'Max Drawdown'), `${number(metrics.maxDrawdownPercent)}%`],
    ['Recovery Factor', number(metrics.recoveryFactor)],
    [t('胜率', 'Win Rate'), `${number(metrics.winRatePercent)}%`],
    [t('交易次数', 'Trades'), Number(metrics.totalTrades).toLocaleString()],
  ];
  const verificationLabels = {
    unverified: [t('未认证', 'Unverified'),'text-zinc-500 border-zinc-700 bg-zinc-900'],
    screenshot_reviewed: [t('截图已审核', 'Screenshots Reviewed'),'text-cyan-300 border-cyan-500/30 bg-cyan-500/10'],
    report_verified: [t('MT5 报告已验证', 'MT5 Report Verified'),'text-violet-300 border-violet-500/30 bg-violet-500/10'],
    reproducible_backtest: [t('可复现回测', 'Reproducible Backtest'),'text-blue-300 border-blue-500/30 bg-blue-500/10'],
    platform_rerun: [t('Nexus 平台复跑', 'Nexus Platform Rerun'),'text-amber-300 border-amber-500/30 bg-amber-500/10'],
    live_verified: [t('Nexus 实盘验证', 'Nexus Live Verified'),'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'],
  };
  const verificationDescriptions = {
    unverified: t('当前没有有效认证；页面数据不能视为 Nexus 对收益或真实性的背书。','No active verification. The displayed data is not a Nexus endorsement of authenticity or returns.'),
    screenshot_reviewed: t('管理员已核对必需截图；截图仍可能被制作或修改。','An administrator reviewed the required screenshots; screenshots can still be fabricated or altered.'),
    report_verified: t('截图与 MT5 HTML 报告已通过一致性门禁；原始报告仍由开发者提供。','Screenshots and an MT5 HTML report passed consistency checks; the source report was still supplied by the developer.'),
    reproducible_backtest: t('已登记参数摘要、数据集、终端版本和回测区间，可按记录复现。','Parameter digest, dataset, terminal build, and test range are recorded for reproduction.'),
    platform_rerun: t('Nexus 管理端已登记独立复跑编号、环境与结果摘要。','A Nexus-administered rerun ID, environment, and result digest are recorded.'),
    live_verified: t('只读实盘观察达到最低 30 天；认证会到期，且不代表未来收益。','Read-only live observation reached at least 30 days. Verification expires and does not predict future returns.'),
  };
  const [verificationLabel,verificationStyle]=verificationLabels[verification?.level || 'unverified'];

  return (
    <div className="space-y-6">
      <div className={`rounded-2xl border p-4 ${verificationStyle}`}>
        <div className="text-sm font-black">{verificationLabel}</div>
        <div className="mt-1 text-xs opacity-80">{verificationDescriptions[verification?.level || 'unverified']}</div>
        <div className="mt-1 text-[11px] opacity-70">{verification?.expired ? t('认证已过期','Verification expired') : verification?.verifiedAt ? `${t('验证时间','Verified')}: ${new Date(verification.verifiedAt).toLocaleString()}` : t('尚无有效验证记录','No active verification record')}</div>
        {verification?.level === 'live_verified' && <div className="mt-2 text-xs">{verification.evidence?.provider} · {verification.evidence?.accountMasked} · {verification.evidence?.observedDays} {t('天只读观察','days read-only observation')}</div>}
      </div>
      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-xs leading-relaxed text-cyan-200/70">
        <div className="flex items-center gap-2 font-bold text-cyan-300"><Info className="h-4 w-4" />{t('数据披露', 'Data disclosure')}</div>
        <p className="mt-1">{t('以下数据由开发者提交，并与管理员审核过的 MT5 截图证据交叉核对。截图可能被修改，因此这不代表 Nexus 实盘认证、收益承诺或独立审计。', 'The developer submitted these figures and an administrator cross-checked them against MT5 screenshot evidence. Screenshots can be manipulated, so this is not Nexus live-account verification, a return guarantee, or an independent audit.')}</p>
      </div>
      {report && <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-3 text-xs text-violet-300">{t('MT5 HTML 原始报告已解析', 'MT5 HTML source report parsed')} · Parser v{report.parserVersion} · SHA-256 {report.sha256.slice(0,16)}…</div>}
      {versions.length>0&&<div className="rounded-2xl border border-violet-500/20 bg-zinc-900/40 p-5"><h4 className="font-bold text-white">{t('版本与更新日志','Versions and release notes')}</h4><div className="mt-3 space-y-2">{versions.map(version=><div key={version.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3"><div className="flex items-center justify-between"><span className="font-bold text-violet-300">v{version.version}{version.isCurrent?` · ${t('当前版本','Current')}`:''}</span><span className="text-[10px] text-zinc-600">SHA-256 {version.sha256?.slice(0,12)}…</span></div><p className="mt-1 whitespace-pre-wrap text-xs text-zinc-500">{version.releaseNotes}</p><div className="mt-1 text-[10px] text-zinc-600">{version.upgradePolicy==='all_existing'?t('所有已有买家继承','All existing owners inherit'):t('仅发布后的新买家可下载','Only purchases after release are eligible')}</div></div>)}</div></div>}

      {evidence.length > 0 && <div className="rounded-2xl border border-emerald-500/20 bg-zinc-900/40 p-5">
        <h4 className="mb-4 font-bold text-white">{t('已审核 MT5 证据', 'Reviewed MT5 Evidence')}</h4>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {evidence.map(item => <a key={item.id} href={item.previewUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
            <Image src={item.previewUrl} alt={`MT5 ${item.type}`} width={1200} height={700} unoptimized className="h-44 w-full object-contain" />
            <div className="flex items-center justify-between px-3 py-2 text-[10px] text-zinc-500"><span className="font-bold uppercase text-emerald-400">{item.type}</span><span>SHA-256 {item.sha256.slice(0, 12)}…</span></div>
          </a>)}
        </div>
      </div>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">{label}</div>
            <div className="mt-2 text-lg font-black text-white">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
          <h4 className="mb-4 flex items-center gap-2 font-bold text-white"><TrendingUp className="h-4 w-4 text-emerald-400" />{t('净值曲线', 'Equity Curve')}</h4>
          <LineChart points={metrics.equityCurve} valueKey="value" color="#34d399" t={t} />
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
          <h4 className="mb-4 flex items-center gap-2 font-bold text-white"><TrendingDown className="h-4 w-4 text-red-400" />{t('回撤曲线', 'Drawdown Curve')}</h4>
          <LineChart points={metrics.drawdownCurve} valueKey="percent" color="#fb7185" suffix="%" t={t} />
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
        <h4 className="mb-4 flex items-center gap-2 font-bold text-white"><BarChart3 className="h-4 w-4 text-cyan-400" />{t('月度收益', 'Monthly Returns')}</h4>
        <MonthlyBars points={metrics.monthlyReturns} t={t} />
      </div>

      <div className="flex items-center gap-2 text-[11px] text-zinc-600">
        <Activity className="h-3.5 w-3.5" />
        {t('管理员审核时间：', 'Administrator review: ')}{metrics.reviewedAt ? new Date(metrics.reviewedAt).toLocaleString() : '-'}
      </div>
    </div>
  );
}
