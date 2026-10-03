"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, FileCheck2, ShieldCheck, TrendingUp } from 'lucide-react';
import { Badge, Button, EmptyState, Panel } from './ui/UiKit';
import { StrategyCard } from './HomeView';
import EditorialLeadStrategy from './EditorialLeadStrategy';
import FeaturedStrategyList from './FeaturedStrategyList';
import HomeResources from './HomeResources';
import { editorialArticleCover } from './editorialArticleCover';

export const DEFAULT_HOME_MODULES = ['hero','topics','featured','advertisement','articles','verification'];
export default function EditorialHome({ siteSettings, products, forumPosts, setRoute, user, setAuthModal, openPostDetail, t }) {
  const settings = siteSettings || {};
  const active = products.filter(product => product.status === 'active');
  const ids = Array.isArray(settings.featuredProductIds) ? settings.featuredProductIds : [];
  const featured = (Array.isArray(settings.featuredProductIds) ? ids.map(id => active.find(product => product.id === Number(id))).filter(Boolean) : active.filter(product => product.report && product.metrics?.reviewedAt)).slice(0,3);
  const featuredKey = featured.map(product => product.id).join(',');
  const [index, setIndex] = useState(0);
  const seconds = Math.max(3, Math.min(60, Number(settings.featuredRotationSeconds) || 6));
  useEffect(() => {
    if (featured.length < 2 || settings.featuredAutoRotate === false) return undefined;
    const timer = setInterval(() => setIndex(current => (current + 1) % featured.length), seconds * 1000);
    return () => clearInterval(timer);
  }, [featured.length, featuredKey, seconds, settings.featuredAutoRotate]);
  const lead = featured[index % Math.max(1,featured.length)];
  const publish = () => user ? setRoute('upload') : setAuthModal('login');
  const openStrategy = product => { sessionStorage.setItem('market_view','detail'); sessionStorage.setItem('market_ea',JSON.stringify(product)); setRoute('market'); };
  const modules = Array.isArray(settings.homeModules) ? settings.homeModules : DEFAULT_HOME_MODULES;
  const parts = {
    hero: <section className="editorial-hero grid gap-7 rounded-2xl p-6 md:p-10 lg:grid-cols-[1.1fr_1fr]"><div className="editorial-hero-copy flex flex-col justify-center"><p className="text-sm tracking-widest">MT5 · XAUUSD · {t('外汇策略研究','Forex strategy research')}</p><h1 className="mt-5 text-3xl font-black leading-tight sm:text-5xl">{settings.homeHeroTitle || t('发现适合你的 EA 量化策略','Discover your next EA strategy')}</h1><p className="mt-5 max-w-xl text-sm leading-7 opacity-80">{settings.homeHeroDescription || t('查阅真实资料，理解策略风险。连接 EA 开发者、黄金交易研究与量化社区。','Explore evidence, understand risk, and connect with the quantitative trading community.')}</p><div className="mt-7 flex flex-wrap gap-3"><Button variant="primary" onClick={() => setRoute('market')}>{t('浏览策略','Browse strategies')}<ArrowRight className="h-4 w-4"/></Button><Button onClick={publish}>{t('发布策略','Publish strategy')}</Button></div></div><div className="editorial-hero-preview">{lead ? <EditorialLeadStrategy product={lead} t={t}/> : <EmptyState title={t('等待管理员配置精选策略','Waiting for featured strategies')}/>}<div className="mt-3 flex justify-end gap-2">{featured.map((product,position) => <button key={product.id} onClick={() => setIndex(position)} aria-label={`${t('切换精选策略','Switch strategy')} ${position + 1}`} aria-pressed={position === index % Math.max(1,featured.length)} className={`h-2 rounded-full ${position === index % Math.max(1,featured.length) ? 'w-6 bg-teal-400' : 'w-2 bg-slate-400'}`}/>)}</div></div></section>,
    topics: <section className="grid gap-4 md:grid-cols-2"><Link href="/xauusd-gold-ea" className="editorial-topic editorial-topic-gold"><TrendingUp className="h-8 w-8"/><div><h2>XAUUSD {t('黄金研究专区','Gold research')}</h2><p>{t('回撤、执行成本与黄金 EA 风险研究','Drawdown, execution costs and gold EA risks')}</p><span>{t('查看专题','Explore')} →</span></div></Link><Link href="/ea-strategies" className="editorial-topic editorial-topic-navy"><BookOpen className="h-8 w-8"/><div><h2>{t('MT5 使用指南','MT5 guides')}</h2><p>{t('从报告理解、策略筛选到授权使用','From report analysis to strategy selection and licensing')}</p><span>{t('查看资料','Read guides')} →</span></div></Link></section>,
    featured: <section><div className="editorial-section-heading"><h2>{t('精选 EA 策略','Featured EA strategies')}</h2><Button variant="ghost" onClick={() => setRoute('market')}>{t('查看全部','View all')} →</Button></div><FeaturedStrategyList products={featured} t={t} renderCard={(product,horizontal) => <StrategyCard product={product} horizontal={horizontal} onOpen={openStrategy} t={t}/>} /></section>,
    advertisement: (settings.exchangeAdEnabled === true || settings.exchangeAdEnabled === 'true') && settings.exchangeAdTitle && settings.exchangeAdDescription ? <Panel className="editorial-sponsor-banner flex flex-wrap items-center justify-between gap-4 p-5"><div className="min-w-0 flex-1"><Badge variant="warning">{t('广告','Advertisement')}</Badge><h2 className="mt-2 font-bold">{settings.exchangeAdTitle}</h2><p className="mt-1 text-sm text-slate-500">{settings.exchangeAdDescription}</p></div>{/^https?:\/\//i.test(settings.exchangeAdUrl || '') && <a className="editorial-link-button" href="/api/analytics/ad-click" target="_blank" rel="noopener noreferrer sponsored">{settings.exchangeAdCta || t('了解更多','Learn more')} →</a>}</Panel> : null,
    articles: <section><div className="editorial-section-heading"><h2>{t('最新研究与社区动态','Research and community')}</h2><Button variant="ghost" onClick={() => setRoute('forum')}>{t('进入社区','Open community')} →</Button></div><div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]"><div className="grid gap-4 sm:grid-cols-2">{forumPosts.slice(0,Number(settings.homeArticleCount) || 4).map(post => <Panel key={post.id} interactive className="overflow-hidden"><button className="w-full text-left" onClick={() => openPostDetail(post)}><div className={`editorial-article-cover ${editorialArticleCover(post)}`}><BookOpen className="h-10 w-10"/><span>{post.category}</span></div><div className="p-5"><h3 className="line-clamp-2 text-base font-bold">{post.title}</h3><p className="mt-3 line-clamp-2 text-xs leading-6 text-slate-500">{String(post.content || '').replace(/[#*]/g,'')}</p><p className="mt-4 text-xs text-slate-500">{post.author} · {post.comment_count || 0} {t('回复','replies')}</p></div></button></Panel>)}</div><HomeResources {...{forumPosts,openPostDetail,publish,t}}/></div>{!forumPosts.length && <EmptyState title={t('暂无公开文章','No public articles yet')}/>}</section>,
    verification: <Panel className="editorial-verification-panel p-6"><h2 className="text-lg font-bold">{t('验证资料如何帮助决策','Understanding verification')}</h2><div className="mt-5 grid gap-4 sm:grid-cols-3">{[[FileCheck2,t('报告与资料','Reports'),t('核对资料来源与回测条件','Review sources and test conditions')],[ShieldCheck,t('审核与披露','Review'),t('查看文字化验证状态','Read verification labels')],[TrendingUp,t('独立判断风险','Assess risk'),t('历史表现不代表未来收益','Past performance does not predict returns')]].map(([Icon,title,detail]) => <div key={title} className="flex items-start gap-3"><Icon className="h-6 w-6 shrink-0 text-teal-600"/><div><h3 className="text-sm font-bold">{title}</h3><p className="mt-2 text-xs text-slate-500">{detail}</p></div></div>)}</div></Panel>,
  };
  return <div className="editorial-home-container"><div className="editorial-home mx-auto max-w-[1380px] space-y-7 px-4 py-7 sm:px-6">{modules.map(key => <div key={key}>{parts[key]}</div>)}</div></div>;
}
