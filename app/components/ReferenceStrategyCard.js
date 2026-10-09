"use client";
import { ArrowRight,ShieldCheck } from 'lucide-react';
import { pointPriceLabel } from '@/lib/point-pricing.mjs';
import { Badge,Button,Panel } from './ui/UiKit';

export function reviewedEquityPath(product) {
  const metrics=product.report&&product.metrics?.reviewedAt?product.metrics:null;
  const values=(metrics?.equityCurve||[]).map(point=>point.value).filter(value=>value!==null&&value!==undefined&&Number.isFinite(Number(value))).map(Number);
  if(values.length<2)return '';
  const low=Math.min(...values),range=Math.max(...values)-low||1;
  return values.map((value,index)=>`${index?'L':'M'} ${(index/(values.length-1)*480).toFixed(1)} ${(78-(value-low)/range*68).toFixed(1)}`).join(' ');
}
export default function ReferenceStrategyCard({product,t,onOpen,lead=false,horizontal=false}) {
  const verified=Boolean(product.report&&product.metrics?.reviewedAt),path=reviewedEquityPath(product);
  return <Panel className={`reference-ea-card ${lead?'reference-ea-lead':''} ${horizontal?'reference-ea-horizontal':''}`}>
    <div className="reference-ea-title">{lead&&<Badge variant="warning">{t('推荐','Featured')}</Badge>}<h3>{product.title}</h3></div>
    <p className="reference-ea-subtitle">{product.pairs || 'MT5'} · {product.author}</p>
    <div className="reference-ea-chart">{path?<svg role="img" aria-label={t('已审核报告的历史净值曲线','Reviewed historical equity curve')} viewBox="0 0 480 88" preserveAspectRatio="none"><path d={path} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke"/></svg>:<span>{t('暂无已审核曲线','No reviewed curve')}</span>}</div>
    <div className="reference-ea-bottom"><Badge variant={verified?'primary':'warning'}>{verified&&<ShieldCheck size={13}/>} {verified?t('MT5 报告已验证','MT5 report verified'):t('未提供验证资料','No verification materials')}</Badge><strong>{pointPriceLabel(product,t)}</strong><Button size="icon" variant="ghost" onClick={()=>onOpen(product)} aria-label={t(`查看 ${product.title} 详情`,`View ${product.title}`)}><ArrowRight size={16}/></Button></div>
    {lead&&<p className="reference-ea-note">{t('历史报告不代表未来收益','Historical reports do not predict future returns')}</p>}
  </Panel>;
}
