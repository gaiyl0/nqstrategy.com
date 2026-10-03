'use client';

import { Badge, EmptyState } from './ui/UiKit';
import { TrendingUp } from 'lucide-react';

export function NewsBriefings({ items, t }) {
  return <section aria-labelledby="forum-briefings-title" className="forum-briefings"><header><h2 id="forum-briefings-title">{t('市场简报 · 重要新闻', 'Market briefing · Key news')}</h2><p>{t('更新时间', 'Updated')} · {items.updatedAt || '—'} · {t('以来源页面为准，展开查看摘要', 'Check sources; expand for summaries')}</p></header><div className="forum-news-grid">{items.news.map((item, index) => <article key={`${item.url}-${index}`}><details><summary><div className="forum-news-meta"><Badge>{t(item.region, item.regionEn)}</Badge><time dateTime={item.date}>{item.date}</time></div><h3>{t(item.title, item.titleEn)}</h3></summary><p className="forum-news-summary">{t(item.summary, item.summaryEn)}</p></details><a href={item.url} target="_blank" rel="noopener noreferrer">{t(item.source, item.sourceEn)} ↗</a></article>)}</div>{items.news.length === 0 && <p>{t('暂无新闻简报。', 'No briefings available.')}</p>}</section>;
}

export function StrategyLibrary({ items, t, expanded = false }) {
  return <details className="forum-playbook" open={expanded || undefined}><summary><div><h2>{t('策略类型速览', 'Strategy playbook')} · {items.strategies.length}</h2><p>{t('教育与研究用途，不构成投资建议或收益承诺', 'For education and research; not investment advice or a return promise')}</p></div><span className="forum-when-closed">{t('展开', 'Expand')} ↓</span><span className="forum-when-open">{t('收起', 'Collapse')} ↑</span></summary><div className="forum-playbook-grid">{items.strategies.map((item, index) => <article key={`${item.title}-${index}`}><h3>{t(item.title, item.titleEn)}</h3><p>{t(item.detail, item.detailEn)}</p></article>)}</div>{items.strategies.length === 0 && <EmptyState icon={TrendingUp} title={t('暂无策略资料', 'No strategy notes yet')} description={t('管理员可以在后台维护策略类型速览。', 'An administrator can maintain strategy notes in settings.')} />}</details>;
}
