"use client";

import React from 'react';
import Image from 'next/image';
import { Activity, BarChart3, Info, TrendingDown, TrendingUp } from 'lucide-react';
import StrategyVerification from './StrategyVerification';
import StrategyVersions from './StrategyVersions';
import {displayNumber,displayDate} from '@/lib/strategy-display.mjs';

function number(value, digits = 2) {
  return displayNumber(value,digits);
}

function LineChart({ points: sourcePoints, valueKey, color, suffix = '', t }) {
  const points = Array.isArray(sourcePoints) ? sourcePoints.filter(point => point && point[valueKey] !== null && point[valueKey] !== undefined && Number.isFinite(Number(point[valueKey]))) : [];
  if(points.length<2)return <p className="text-sm text-zinc-400">{t('暂无可信曲线数据','No trusted curve data')}</p>;
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
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-zinc-400">
        <span>{first.date}</span>
        <span>{number(min)}{suffix} – {number(max)}{suffix}</span>
        <span>{last.date}</span>
      </div>
    </div>
  );
}

function MonthlyBars({ points: sourcePoints = [], t }) {
  const points = Array.isArray(sourcePoints) ? sourcePoints.filter(point => point && point.percent !== null && point.percent !== undefined && Number.isFinite(Number(point.percent))) : [];
  if(!points.length)return <p className="text-sm text-zinc-400">{t('暂无月度收益数据','No monthly return data')}</p>;
  const maxAbs = Math.max(1, ...points.map((point) => Math.abs(Number(point.percent))));
  return (
    <div className="overflow-x-auto custom-scrollbar">
      <div className="flex h-48 min-w-max items-center gap-2 border-b border-zinc-800 px-2 pt-3">
        {points.map((point) => {
          const positive = Number(point.percent) >= 0;
          const height = Math.max(8, (Math.abs(Number(point.percent)) / maxAbs) * 105);
          return (
            <div key={point.month} className="flex h-full w-14 shrink-0 flex-col items-center justify-end gap-2">
              <span className={`text-xs font-bold ${positive ? 'text-emerald-400' : 'text-red-400'}`}>{positive ? '+' : ''}{number(point.percent)}%</span>
              <div className={`w-7 rounded-t ${positive ? 'bg-emerald-500/70' : 'bg-red-500/70'}`} style={{ height }} title={`${point.month}: ${point.percent}%`} />
              <span className="pb-2 text-xs text-zinc-400">{point.month}</span>
            </div>
          );
        })}
      </div>
      <div className="sr-only">{t('月度收益柱状图', 'Monthly returns bar chart')}</div>
    </div>
  );
}

export default function StrategyMetrics({ metrics: sourceMetrics, evidence = [], report = null, verification = null, versions = [], showVerification = true, t }) {
  const metrics = sourceMetrics?.reviewedAt ? sourceMetrics : null;
  const cards = metrics ? [
    [t('初始资金', 'Initial Deposit'), number(metrics.initialDeposit)==='—'?'—':`$${number(metrics.initialDeposit)}`],
    [t('净利润', 'Net Profit'), number(metrics.netProfit)==='—'?'—':`${Number(metrics.netProfit) >= 0 ? '+' : '-'}$${number(Math.abs(metrics.netProfit))}`],
    ['Profit Factor', number(metrics.profitFactor)],
    ['Sharpe Ratio', number(metrics.sharpeRatio)],
    [t('最大回撤', 'Max Drawdown'), number(metrics.maxDrawdownPercent)==='—'?'—':`${number(metrics.maxDrawdownPercent)}%`],
    ['Recovery Factor', number(metrics.recoveryFactor)],
    [t('胜率', 'Win Rate'), number(metrics.winRatePercent)==='—'?'—':`${number(metrics.winRatePercent)}%`],
    [t('交易次数', 'Trades'), number(metrics.totalTrades,0)],
  ] : [];
  return (
    <div className="nq-readable nq-report-content space-y-6">
      {showVerification && <StrategyVerification verification={verification} t={t}/>}
      <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm leading-7 text-cyan-200">
        <div className="flex items-center gap-2 font-bold text-cyan-300"><Info aria-hidden="true" className="h-4 w-4" />{t('数据披露', 'Data disclosure')}</div>
        <p className="mt-1">{metrics?t('以下为开发者提交并经管理员审核的历史数据；请核对资料范围，认证不等于收益保证。','These historical figures were submitted by the developer and reviewed by an administrator. Review the evidence scope; verification does not guarantee returns.'):t('尚无已审核的结构化表现数据，收益、初始资金及回撤未披露。报告与截图是可选资料，未提供也可申请上架审核，之后再补充。','There are no reviewed structured performance figures. Returns, initial capital and drawdown are not disclosed. Reports and screenshots are optional for listing review and may be added later.')}</p>
      </div>
      {report && <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-3 text-xs leading-6 text-violet-300">{t('MT5 HTML 原始报告已解析', 'MT5 HTML source report parsed')} · Parser {report.parserVersion?`v${report.parserVersion}`:t('版本未披露','version not disclosed')} · SHA-256 {report.sha256?`${report.sha256.slice(0,16)}…`:t('未披露','not disclosed')}</div>}
      {versions.length>0&&<div className="rounded-xl border border-slate-700/60 p-4"><h3 className="mb-4 font-bold text-white">{t('版本与更新日志','Versions and release notes')}</h3><StrategyVersions versions={versions} t={t}/></div>}
      {evidence.length > 0 && <div className="rounded-2xl border border-emerald-500/20 bg-zinc-900/40 p-5">
        <h4 className="mb-4 font-bold text-white">{t('已审核 MT5 证据', 'Reviewed MT5 Evidence')}</h4>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {evidence.map(item => <a key={item.id} href={item.previewUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
            <Image src={item.previewUrl} alt={`MT5 ${item.type}`} width={1200} height={700} sizes="(max-width: 767px) calc(100vw - 2rem), 50vw" unoptimized className="h-44 w-full object-contain" />
            <div className="flex items-center justify-between px-3 py-2 text-xs text-zinc-400"><span className="font-bold uppercase text-emerald-400">{item.type}</span><span>SHA-256 {item.sha256?.slice(0, 12) || '—'}…</span></div>
          </a>)}
        </div>
      </div>}

      {metrics && <><div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-zinc-400">{label}</div>
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

      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <Activity className="h-3.5 w-3.5" />
        {t('管理员审核时间：', 'Administrator review: ')}{displayDate(metrics.reviewedAt,t)}
      </div></>}
    </div>
  );
}
