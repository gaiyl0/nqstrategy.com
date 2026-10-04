"use client";

import Link from 'next/link';
import { Mt5DownloadLink } from './Mt5Download';
import { BookOpen, ArrowRight } from 'lucide-react';
import { Button, Panel } from './ui/UiKit';

export default function HomeResources({ forumPosts, openPostDetail, publish, t, siteSettings }) {
  const related = forumPosts.filter(post => (!post.moderation_status || post.moderation_status === 'visible') && /MT5|\bEA\b|XAUUSD|黄金|回测|风险|网格|外汇/i.test(post.title)).slice(0,3);
  return <aside aria-label={t('资料与入门','Resources')} className="home-resources-stack space-y-4">
    <Panel className="editorial-resources-panel p-5"><h3 className="flex items-center gap-2 text-base font-bold text-white"><BookOpen className="h-5 w-5 text-cyan-300"/>{t('资料与入门','Resources')}</h3><div className="mt-4 space-y-3 text-sm text-slate-300"><Mt5DownloadLink settings={siteSettings} t={t}/><Link className="block py-1" href="/ea-strategies">{t('如何筛选 MT5 EA 策略','How to select an MT5 EA')} →</Link><Link className="block py-1" href="/xauusd-gold-ea">{t('XAUUSD 黄金策略风险核对','Review XAUUSD risks')} →</Link><Link className="block py-1" href="/help#verification">{t('报告验证与实盘认证说明','Report and live verification explained')} →</Link><Link className="block py-1" href="/help#licenses">{t('下载、版本与运行授权','Downloads, versions and runtime licenses')} →</Link></div><p className="mt-4 text-xs leading-6 text-slate-400">{t('历史报告与认证不能保证未来表现，请独立核对风险。','Historical reports and verification cannot guarantee future performance.')}</p></Panel>
    {related.length > 0 && <Panel className="home-related-research p-5"><h3 className="text-base font-bold text-white">{t('相关社区研究','Related community research')}</h3><ul className="mt-2 divide-y divide-slate-700/50">{related.map(post => <li key={post.id} className="py-3"><button onClick={() => openPostDetail(post)} className="block w-full break-words text-left text-sm font-semibold leading-6 text-slate-200">{post.title}</button><p className="mt-1 break-words text-xs text-slate-400">{post.category} · {post.author}</p></li>)}</ul></Panel>}
    <Panel className="home-resource-action p-5"><h3 className="text-base font-bold text-white">{t('从研究到发布','From research to publishing')}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{t('整理策略逻辑与适用条件。验证资料可选，提交后等待审核。','Describe your strategy and its conditions. Evidence is optional; submissions require review.')}</p><Button className="mt-4 w-full" onClick={publish}>{t('发布你的 EA 策略','Publish your EA')}<ArrowRight className="h-4 w-4"/></Button></Panel>
  </aside>;
}
