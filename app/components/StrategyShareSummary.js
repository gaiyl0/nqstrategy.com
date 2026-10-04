import Link from 'next/link';
import { verificationDisplay, displayNumber } from '@/lib/strategy-display.mjs';

export default function StrategyShareSummary({ product }) {
  const verification = verificationDisplay(product.verification);
  const reviewed = product.report && product.metrics?.reviewedAt;
  const level = product.verification?.level;
  const values = reviewed ? (product.metrics.equityCurve || []).filter(point=>point?.value!==null && point?.value!==undefined && Number.isFinite(Number(point.value))).map(point=>Number(point.value)) : [];
  const min = values.length ? Math.min(...values) : 0;
  const range = values.length ? Math.max(...values)-min || 1 : 1;
  const curve = values.map((value,index)=>`${index?'L':'M'} ${10+index/(values.length-1)*980} ${140-(value-min)/range*120}`).join(' ');
  return <section className="strategy-share-summary share-card"><div className="share-summary-heading"><h2>分享摘要 · 验证与风险</h2><Link href="#strategy-verification">查看完整验证资料 →</Link></div><div className="share-status-list"><span>已审核上架</span><span>{verification.label}</span>{verification.statusLabel && <span>{verification.statusLabel}</span>}</div>{reviewed?<>{values.length>1 && <div className="share-history"><p>MT5 历史净值曲线 · 原始报告数据</p><svg viewBox="0 0 1000 160" preserveAspectRatio="none" role="img" aria-label="MT5 历史净值曲线"><path d={curve} fill="none" stroke="#10aaa3" strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg></div>}<div className="share-metric-grid">{[['Profit Factor',displayNumber(product.metrics.profitFactor)],['Sharpe',displayNumber(product.metrics.sharpeRatio)],['最大回撤',`${displayNumber(product.metrics.maxDrawdownPercent)}%`],['交易次数',displayNumber(product.metrics.totalTrades,0)]].map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><p className="share-data-source">数据来源：管理员已审核的 MT5 历史报告。</p></>:<div className="share-empty-report"><strong>{product.report?'报告资料尚未完成指标审核':product.evidence?.length?'已提供截图，未提供 MT5 原始报告':'未提供验证资料'}</strong><p>收益、回撤和初始资金不作为已验证表现展示，请核对开发者说明与运行条件。</p></div>}<dl className="share-evidence-list"><div><dt>MT5 历史报告</dt><dd>{product.report?'已解析':'未提供'}</dd></div><div><dt>平台独立复跑</dt><dd>{level==='platform_rerun'?'已登记验证':'无有效平台复跑认证'}</dd></div><div><dt>实盘验证</dt><dd>{level==='live_verified'?'有效认证':'无有效实盘认证'}</dd></div></dl><p className="share-disclosure">报告验证不等于实盘验证。历史表现不代表未来收益。</p></section>;
}
