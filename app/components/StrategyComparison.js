"use client";

import React from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { comparisonAvailability } from '@/lib/strategy-comparison.mjs';
import {pointPriceLabel} from '@/lib/point-pricing.mjs';

const levels = {
  unverified: '未认证', screenshot_reviewed: '截图已审核', report_verified: 'MT5 报告已验证',
  reproducible_backtest: '可复现回测', platform_rerun: 'Nexus 平台复跑', live_verified: 'Nexus 实盘验证',
};

function format(value, suffix = '', digits = 2) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toLocaleString(undefined, { maximumFractionDigits: digits })}${suffix}` : '不可比较';
}

export default function StrategyComparison({ products, onRemove, onClose, t }) {
  const rows = [
    [t('证据层级', 'Evidence level'), product => levels[product.verification?.level || 'unverified']],
    [t('数据来源', 'Data source'), product => product.verification?.level === 'live_verified' ? t('只读实盘观察', 'Read-only live observation') : product.verification?.level === 'platform_rerun' ? t('平台独立复跑', 'Platform rerun') : t('开发者 MT5 回测', 'Developer MT5 backtest')],
    [t('报告 / 版本', 'Report / version'), product => product.report && product.currentVersion ? `MT5 SHA ${product.report.sha256?.slice(0, 8)}… · v${product.currentVersion.version}` : t('不可比较', 'Not comparable')],
    ['Profit Factor ↑', product => format(product.metrics?.profitFactor)],
    ['Sharpe Ratio ↑', product => format(product.metrics?.sharpeRatio)],
    [t('最大回撤 ↓', 'Max drawdown ↓'), product => format(product.metrics?.maxDrawdownPercent, '%')],
    ['Recovery Factor ↑', product => format(product.metrics?.recoveryFactor)],
    [t('胜率 ↑', 'Win rate ↑'), product => format(product.metrics?.winRatePercent, '%')],
    [t('交易次数', 'Trades'), product => format(product.metrics?.totalTrades, '', 0)],
    [t('初始资金', 'Initial deposit'), product => `$${format(product.metrics?.initialDeposit)}`],
    [t('净利润（仅同资金与区间可比）', 'Net profit (comparable only with same capital and period)'), product => `$${format(product.metrics?.netProfit)}`],
    [t('积分价格', 'Points price'), product => pointPriceLabel(product,t)],
  ];

  return <div className="rounded-3xl border border-cyan-500/30 bg-zinc-950 p-5 shadow-2xl">
    <div className="flex items-start justify-between gap-4"><div><h3 className="text-xl font-black text-white">{t('策略并排对比', 'Strategy comparison')}</h3><p className="mt-1 text-xs text-zinc-500">{t('↑ 越高通常越好，↓ 越低通常越好；只使用已审核结构化指标。', '↑ is generally higher-is-better, ↓ lower-is-better. Only reviewed structured metrics are used.')}</p></div><button onClick={onClose} aria-label={t('关闭对比', 'Close comparison')} className="rounded-lg border border-zinc-800 p-2 text-zinc-400"><X className="h-4 w-4" /></button></div>
    <div className="mt-4 flex gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-200/80"><AlertTriangle className="h-4 w-4 shrink-0" />{t('回测、平台复跑和实盘观察属于不同证据层级。绝对净利润受初始资金、测试区间与风险暴露影响，系统不会据此自动评出“最佳策略”。', 'Backtests, platform reruns and live observations are different evidence levels. Absolute profit depends on capital, period and risk exposure, so the system does not name an automatic “best strategy”.')}</div>
    <div className="mt-5 overflow-x-auto custom-scrollbar"><table className="min-w-[760px] w-full border-collapse text-left text-xs"><thead><tr><th className="sticky left-0 z-10 w-48 bg-zinc-950 p-3 text-zinc-500">{t('指标', 'Metric')}</th>{products.map(product => <th key={product.id} className="min-w-48 border-l border-zinc-800 p-3"><div className="flex items-start justify-between gap-2"><span className="text-sm text-white">{product.title}</span><button aria-label={t('移出对比','Remove from comparison')} onClick={() => onRemove(product.id)} className="text-zinc-600 hover:text-red-400"><X className="h-3.5 w-3.5" /></button></div><div className={`mt-1 flex items-center gap-1 text-[10px] ${comparisonAvailability(product) ? 'text-emerald-400' : 'text-amber-400'}`}><CheckCircle2 className="h-3 w-3" />{comparisonAvailability(product) ? t('可量化比较', 'Comparable') : t('证据不完整', 'Incomplete evidence')}</div></th>)}</tr></thead><tbody>{rows.map(([label, getter]) => <tr key={label} className="border-t border-zinc-800"><th className="sticky left-0 z-10 bg-zinc-950 p-3 font-medium text-zinc-400">{label}</th>{products.map(product => <td key={product.id} className="border-l border-zinc-800 p-3 font-mono text-zinc-200">{comparisonAvailability(product) ? getter(product) : t('不可比较', 'Not comparable')}</td>)}</tr>)}</tbody></table></div>
  </div>;
}
