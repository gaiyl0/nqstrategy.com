"use client";

import Image from 'next/image';
import ShareActions from './ShareActions';
import StrategyShareSummary from './StrategyShareSummary';
import {Cpu,Info,Star} from 'lucide-react';
import StrategyMetrics from './StrategyMetrics';
import StrategyVerification from './StrategyVerification';
import StrategyVersions from './StrategyVersions';
import {Badge} from './ui/UiKit';
import {displayDate,displayNumber,upgradeLabel,verificationDisplay} from '@/lib/strategy-display.mjs';

export default function StrategyDetail({product,back,actions,ratingAction,t,tEaType=value=>value}) {
  const verification=verificationDisplay(product.verification,t);
  const reviewed=Boolean(product.metrics?.reviewedAt);
  const disclosure=product.report?t('已提供 MT5 原始报告','MT5 source report provided'):product.evidence?.length?t('已提供截图资料，未提供 MT5 原始报告','Screenshot evidence provided; no MT5 source report'):t('未提供验证资料','No verification materials provided');
  const tags=[...new Set(String(product.ea_type||'').split(',').map(value=>value.trim()).filter(Boolean))];
  const sections=[['overview',t('概览','Overview')],['verification',t('验证与报告','Verification & reports')],['versions',t('版本','Versions')],['reviews',t('评价','Ratings')]];
  return <div className="strategy-detail nq-readable mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">{back}</div>
    <header className="strategy-detail-hero rounded-2xl border p-5 sm:p-7">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,.65fr)]"><div className="min-w-0">
      <div className="flex items-start gap-4">{product.logo_url?<Image src={product.logo_url} alt={`${product.title} logo`} width={80} height={80} sizes="80px" className="h-16 w-16 shrink-0 rounded-xl border border-slate-500/40 object-cover sm:h-20 sm:w-20"/>:<div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-slate-500/40 bg-slate-900 sm:h-20 sm:w-20"><Cpu className="h-7 w-7 text-cyan-300"/></div>}<div className="min-w-0"><p className="detail-hero-meta text-xs">MetaTrader 5 · {t('自动交易策略','Automated trading strategy')}</p><h1 className="mt-2 break-words text-2xl font-black leading-tight sm:text-3xl">{product.title}</h1><p className="detail-hero-meta mt-2 break-words text-sm">{product.author||t('作者未披露','Author not disclosed')} · {t('发布于','Published')} {displayDate(product.created_at,t)}</p></div></div>
      <div className="mt-5 flex flex-wrap gap-2"><Badge className={`detail-hero-badge ${verification.variant}`} variant={verification.variant}>{verification.label}</Badge>{verification.statusLabel&&<Badge className={`detail-hero-badge ${verification.variant}`} variant={verification.variant}>{verification.statusLabel}</Badge>}<Badge className={`detail-hero-badge ${product.report?'primary':'warning'}`} variant={product.report?'primary':'warning'}>{disclosure}</Badge></div>
      <div className="mt-5 border-t border-slate-500/30 pt-4"><p className="detail-hero-meta text-xs">{t('售价','Price')} · USD</p><p className="detail-hero-price mt-1 text-3xl font-black">{displayNumber(product.price)==='—'?t('未披露','Not disclosed'):Number(product.price)===0?t('免费','Free'):`$${displayNumber(product.price)}`}</p><p className="detail-hero-meta mt-2 text-xs leading-6">{upgradeLabel(product.currentVersion?.upgradePolicy,t)}</p></div>
      </div><div className="strategy-detail-actions flex flex-col justify-center gap-2">{actions}</div></div>
    </header>
    {product.slug && product.status === 'active' && <><div className="mt-5"><ShareActions title={product.title} path={`/market/${encodeURIComponent(product.slug)}`} t={t}/></div><StrategyShareSummary product={product}/></>}
    <nav aria-label={t('策略详情分区','Strategy detail sections')} className="strategy-detail-nav sticky z-30 mt-5 grid grid-cols-2 gap-1 rounded-xl border p-2 sm:grid-cols-4">{sections.map(([id,label])=><a key={id} href={`#strategy-${id}`} className="flex min-h-11 items-center justify-center rounded-lg px-2 text-center text-sm font-semibold">{label}</a>)}</nav>
    <div className="mt-5 space-y-5">
      <section id="strategy-overview" tabIndex={-1} className="strategy-detail-section rounded-xl border p-5 sm:p-6"><h2 className="text-xl font-bold text-white">{t('策略概览','Strategy overview')}</h2><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">{[[t('运行平台','Platform'),'MetaTrader 5'],[t('交易品种','Pairs'),product.pairs||t('未披露','Not disclosed')],[t('适用周期','Timeframe'),t('未披露，请核对策略说明','Not disclosed; check the strategy description')],[t('当前版本','Current version'),product.currentVersion?.version?`v${product.currentVersion.version}`:t('未披露','Not disclosed')]].map(([label,value])=><div key={label} className="min-w-0"><dt className="text-xs text-slate-400">{label}</dt><dd className="mt-1 break-words text-slate-200">{value}</dd></div>)}</dl><div className="mt-4 flex flex-wrap gap-2">{tags.map(tag=><Badge key={tag}>{tEaType(tag)}</Badge>)}</div><h3 className="mt-5 font-semibold text-white">{t('策略说明','Strategy description')}</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-8 text-slate-300">{product.description||t('开发者尚未提供详细说明。','The developer has not provided a detailed description.')}</p></section>
      <section id="strategy-verification" tabIndex={-1} className="strategy-detail-section rounded-xl border p-5 sm:p-6"><h2 className="text-xl font-bold text-white">{t('验证与报告','Verification & reports')}</h2><div className="mt-4"><StrategyVerification verification={product.verification} t={t}/></div><div className="mt-4"><StrategyMetrics metrics={reviewed?product.metrics:null} evidence={product.evidence||[]} report={product.report} verification={product.verification} showVerification={false} t={t}/></div></section>
      <section id="strategy-versions" tabIndex={-1} className="strategy-detail-section rounded-xl border p-5 sm:p-6"><h2 className="mb-4 text-xl font-bold text-white">{t('版本与更新日志','Versions and release notes')}</h2><StrategyVersions versions={product.versions||[]} t={t}/></section>
      <section id="strategy-reviews" tabIndex={-1} className="strategy-detail-section rounded-xl border p-5 sm:p-6"><h2 className="text-xl font-bold text-white">{t('永久授权用户评分','Permanent owner rating')}</h2><p className="mt-4 flex items-center gap-2 text-base text-amber-300"><Star aria-hidden="true" className="h-5 w-5"/>{displayNumber(product.social?.ratingAverage)} / 5 · {product.social?.ratingCount||0} {t('条评分','ratings')}</p>{product.social?.viewer?.rating&&<p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-300">{t('我的评价','My review')}: {product.social.viewer.rating.reviewText||t('未填写文字评价','No written review')}</p>}<div className="mt-4">{ratingAction}</div><p className="mt-3 text-xs leading-6 text-slate-400">{t('只有持有有效永久授权的用户可评分；开发者不能评价自己的策略。','Only active permanent owners may rate; developers cannot rate their own strategy.')}</p></section>
      {product.slug && product.status === 'active' && <ShareActions title={product.title} path={`/market/${encodeURIComponent(product.slug)}`} t={t}/>}
      <p className="flex items-start gap-2 text-xs leading-7 text-slate-400"><Info aria-hidden="true" className="mt-1 h-4 w-4 shrink-0"/>{t('历史回测、报告验证和用户评分不能保证未来收益。部署前请核对执行成本、参数与资金风险。','Historical tests, report verification and ratings do not guarantee future returns. Review execution costs, parameters and capital risk before deployment.')}</p>
    </div>
  </div>;
}
