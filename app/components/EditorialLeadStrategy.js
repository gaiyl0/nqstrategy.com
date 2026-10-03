"use client";

import { Badge, Panel } from './ui/UiKit';

const format = value => value !== null && value !== undefined && Number.isFinite(Number(value))
  ? Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—';
const percent = value => format(value) === '—' ? '—' : `${format(value)}%`;

function equityPath(points) {
  const values = Array.isArray(points) ? points.map(point => point.value)
    .filter(value => value !== null && value !== undefined && Number.isFinite(Number(value))).map(Number) : [];
  if (values.length < 2) return '';
  const minimum = Math.min(...values);
  const range = Math.max(...values) - minimum || 1;
  return values.map((value, index) => `${index ? 'L' : 'M'} ${(index / (values.length - 1) * 480).toFixed(1)} ${(64 - (value - minimum) / range * 52).toFixed(1)}`).join(' ');
}

// A compact summary keeps every featured slide the same height. Full reports remain in the detail view.
export default function EditorialLeadStrategy({ product, t }) {
  const metrics = product.report && product.metrics?.reviewedAt ? product.metrics : null;
  const curve = metrics ? equityPath(metrics.equityCurve) : '';
  const returns = metrics && Number(metrics.initialDeposit) > 0 && metrics.netProfit !== null && metrics.netProfit !== undefined
    ? Number(metrics.netProfit) / Number(metrics.initialDeposit) * 100 : null;
  const items = metrics ? [
    ['Profit Factor', format(metrics.profitFactor)],
    ['Sharpe', format(metrics.sharpeRatio)],
    [t('最大回撤', 'Max drawdown'), percent(metrics.maxDrawdownPercent)],
    [t('交易次数', 'Trades'), format(metrics.totalTrades)],
    [t('胜率', 'Win rate'), percent(metrics.winRatePercent)],
  ] : [];

  return <Panel className="editorial-lead-card">
    <div className="editorial-lead-heading">
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-sm font-bold" title={product.title}>{product.title}</h2>
        <p className="mt-1 truncate text-[11px] text-slate-500">{product.author} · {product.pairs}</p>
      </div>
      <Badge variant={metrics ? 'primary' : 'warning'}>{metrics ? t('MT5 报告已验证', 'MT5 report verified') : t('未提供验证资料', 'No verification materials')}</Badge>
    </div>
    {metrics ? <div className="editorial-lead-data">
      <div className="flex items-center justify-between text-[10px] text-slate-500">
        <span>{t('历史净值曲线', 'Historical equity')}</span>
        {returns !== null && Number.isFinite(returns) && <strong className={returns >= 0 ? 'text-emerald-600' : 'text-red-600'}>{returns >= 0 ? '+' : ''}{percent(returns)}</strong>}
      </div>
      <div className="editorial-lead-curve">
        {curve ? <svg role="img" aria-label={t('已审核报告的历史净值曲线', 'Reviewed historical equity curve')} viewBox="0 0 480 72" preserveAspectRatio="none"><path d={curve} fill="none" stroke="#139c91" strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg>
          : <p className="text-center text-xs text-slate-500">{t('暂无已审核曲线', 'No reviewed curve')}</p>}
      </div>
      <div className="editorial-lead-metrics">{items.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    </div> : <div className="editorial-lead-disclosure">
      <strong>{t('已审核上架 · 表现未经验证', 'Listed · Performance unverified')}</strong>
      <p>{t('未提供 MT5 报告、净值曲线或实盘证明；收益、回撤和初始资金均未披露。', 'No MT5 report, equity curve or live-account evidence provided. Returns, drawdown and initial deposit are not disclosed.')}</p>
    </div>}
    <p className="editorial-lead-note">{metrics
      ? t('历史报告数据，不代表实时实盘或未来收益。完整报告请查看策略详情。', 'Historical report data, not a live feed or future return guarantee. See strategy details for the full report.')
      : t('未提供验证资料不影响基础上架资格，不能作为表现承诺。', 'Missing verification materials do not block basic listing and cannot substantiate performance claims.')}</p>
  </Panel>;
}
