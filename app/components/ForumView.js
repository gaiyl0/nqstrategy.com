"use client";

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BarChart3, Clock, Code2, Eye, Hash, Megaphone, MessageSquare, PenLine, Search, ShieldCheck, Star, Trash2, TrendingUp, Users, Bold, Heading2, Quote, List, Save, Send, ImagePlus, Paperclip, X, FileText } from 'lucide-react';
import { Badge, Button, EmptyState, Field, Panel, Tabs } from './ui/UiKit';
import { DEFAULT_COMMUNITY_CONTENT } from '@/lib/community-content';
import { apiFetch } from '@/lib/api-client';

const categoryIcons = [MessageSquare, TrendingUp, Code2, BarChart3, Megaphone];
const sorts = t => [
  { value: 'latest', label: t('最新讨论', 'Latest') },
  { value: 'hot', label: t('热门讨论', 'Popular') },
  { value: 'discussed', label: t('精华内容', 'Most discussed') },
];

function Avatar({ source, name, size = 40 }) {
  return source ? <Image src={source} width={size} height={size} alt={`${name} avatar`} className="h-full w-full object-cover" /> : <span>{name?.charAt(0)?.toUpperCase() || '?'}</span>;
}

function ForumNavigation({ categories, activeCategory, tCat, t, onCategory, onCreate, authors }) {
  return <aside className="ForumNavigation hidden w-60 shrink-0 border-r border-slate-800/80 bg-[#08111a]/80 xl:flex xl:flex-col">
    <div className="border-b border-slate-800/80 px-5 py-6"><h1 className="text-xl font-black text-white">{t('开发者社区', 'Developer community')}</h1><p className="mt-2 text-xs leading-5 text-slate-500">{t('分享研究、开发经验与真实问题', 'Share research, development experience and real problems')}</p></div>
    <nav aria-label={t('社区版块', 'Community categories')} className="space-y-1 px-3 py-5">{categories.map((category, index) => { const Icon = categoryIcons[index % categoryIcons.length]; const selected = activeCategory === category; return <button key={category} type="button" onClick={() => onCategory(category)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold transition-colors ${selected ? 'bg-cyan-400/10 text-cyan-300 ring-1 ring-inset ring-cyan-400/20' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'}`}><Icon className="h-4 w-4" /><span>{tCat(category)}</span></button>; })}</nav>
    {authors.length > 0 && <div className="border-t border-slate-800/80 px-5 py-5"><div className="mb-4 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{t('本页活跃作者', 'Active here')}</p><Users className="h-4 w-4 text-cyan-400" /></div><div className="space-y-4">{authors.slice(0, 4).map(author => <div key={author.name} className="flex items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-700 bg-slate-800 text-xs font-bold text-cyan-300"><Avatar source={author.avatar} name={author.name} size={36} /></div><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-200">{author.name}</p><p className="text-[11px] text-slate-600">{author.posts} {t('篇讨论', 'posts')}</p></div></div>)}</div></div>}
    <div className="mt-auto p-4"><Button variant="primary" className="w-full" icon={PenLine} onClick={onCreate}>{t('发布讨论', 'New discussion')}</Button></div>
  </aside>;
}

function CommunityHero({ post, t, tCat, openPostDetail }) {
  if (!post) return null;
  return <Panel interactive className="relative overflow-hidden border-cyan-400/20 p-6 md:p-7"><div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(34,211,238,0.16),transparent_38%),linear-gradient(125deg,rgba(15,23,42,0.15),rgba(2,6,23,0.9))]" /><div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(56,189,248,.14)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,.14)_1px,transparent_1px)] [background-size:36px_36px] [mask-image:linear-gradient(to_left,black,transparent)]" /><button type="button" onClick={() => openPostDetail(post)} className="relative z-10 block w-full text-left"><Badge variant="primary">{post.is_pinned ? t('社区置顶', 'Community pinned') : tCat(post.category)}</Badge><h2 className="mt-4 max-w-3xl text-2xl font-black leading-tight text-white md:text-3xl">{post.title}</h2><p className="mt-3 max-w-3xl line-clamp-2 text-sm leading-6 text-slate-400">{post.content}</p><div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500"><span>{post.author}</span><span>{new Date(post.created_at).toLocaleDateString()}</span><span className="flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" />{post.views || 0}</span><span className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" />{post.comment_count || 0}</span></div></button></Panel>;
}

function PostCard({ post, user, t, tCat, openPostDetail, handlePinPost, handleDeletePost }) {
  return <Panel interactive as="article" className={`group relative p-5 md:p-6 ${post.is_pinned ? 'border-cyan-400/25 bg-cyan-400/[0.035]' : ''}`}><button type="button" className="block w-full text-left" onClick={() => openPostDetail(post)}><div className="flex items-start gap-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-700 bg-slate-800 font-bold text-cyan-300"><Avatar source={post.avatar_url} name={post.author} size={44} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-bold text-slate-100">{post.author}</span>{post.author_role === 'admin' && <ShieldCheck className="h-4 w-4 text-cyan-400" />}<Badge variant={post.is_pinned ? 'primary' : 'violet'}>{post.is_pinned ? t('置顶', 'Pinned') : tCat(post.category)}</Badge></div><p className="mt-1 text-xs text-slate-600">{new Date(post.created_at).toLocaleString()}</p></div></div><h2 className="mt-5 pr-12 text-lg font-bold leading-7 text-white transition-colors group-hover:text-cyan-300">{post.title}</h2><p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-400">{post.content}</p><div className="mt-5 flex items-center gap-5 text-xs text-slate-500"><span className="flex items-center gap-1.5"><MessageSquare className="h-4 w-4" />{post.comment_count || 0}</span><span className="flex items-center gap-1.5"><Eye className="h-4 w-4" />{post.views || 0}</span><span className="ml-auto flex items-center gap-1.5"><Clock className="h-4 w-4" />{new Date(post.created_at).toLocaleDateString()}</span></div></button>{user?.role === 'admin' && <div className="absolute right-4 top-4 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"><Button aria-label={post.is_pinned ? t('取消置顶', 'Unpin') : t('置顶', 'Pin')} size="icon" variant="ghost" onClick={event => handlePinPost(post.id, !post.is_pinned, event)}><Star className="h-4 w-4" /></Button><Button aria-label={t('删除帖子', 'Delete post')} size="icon" variant="danger" onClick={event => handleDeletePost(post.id, event)}><Trash2 className="h-4 w-4" /></Button></div>}</Panel>;
}

function FormattedContent({ content }) {
  const lines = String(content || '').split('\n');
  return <div className="space-y-2">{lines.map((line, index) => {
    const image = line.match(/^!\[([^\]]{0,200})\]\(\/api\/post-attachments\?id=([1-9]\d*)\)$/);
    if (image) return <figure key={`content-image-${index}`} className="my-4"><Image src={`/api/post-attachments?id=${image[2]}`} alt={image[1]} width={1200} height={800} unoptimized className="max-h-[560px] max-w-full rounded-xl border border-slate-800 object-contain" /></figure>;
    if (/^#{1,3}\s/.test(line)) return <h2 key={`content-heading-${index}`} className="pt-3 text-lg font-bold text-white">{line.replace(/^#{1,3}\s/, '')}</h2>;
    if (/^>\s?/.test(line)) return <blockquote key={`content-quote-${index}`} className="border-l-2 border-cyan-400/60 pl-4 italic text-slate-400">{line.replace(/^>\s?/, '')}</blockquote>;
    if (/^[-*•]\s/.test(line)) return <div key={`content-list-${index}`} className="pl-4 text-slate-300">• {line.replace(/^[-*•]\s/, '')}</div>;
    if (!line.trim()) return <div key={`content-space-${index}`} className="h-1" />;
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return <p key={`content-line-${index}`} className="text-slate-300">{parts.map((part, partIndex) => part.startsWith('**') && part.endsWith('**') ? <strong key={`strong-${index}-${partIndex}`} className="font-bold text-white">{part.slice(2, -2)}</strong> : part)}</p>;
  })}</div>;
}

function CommunityAside({ authors, categoryStats, totals, t, tCat }) {
  return <aside className="CommunityAside hidden w-72 shrink-0 space-y-4 2xl:block"><Panel className="p-5"><h2 className="mb-5 font-bold text-white">{t('本页活跃作者', 'Active authors')}</h2><div className="space-y-4">{authors.slice(0, 5).map((author, index) => <div key={author.name} className="flex items-center gap-3"><span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${index < 3 ? 'bg-cyan-400/10 text-cyan-300' : 'bg-slate-800 text-slate-500'}`}>{index + 1}</span><div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-700 bg-slate-800 text-xs font-bold text-cyan-300"><Avatar source={author.avatar} name={author.name} size={36} /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-200">{author.name}</p><p className="text-[11px] text-slate-600">{author.posts} {t('篇 · ', 'posts · ')}{author.comments} {t('条回复', 'replies')}</p></div></div>)}</div>{authors.length === 0 && <p className="text-sm text-slate-600">{t('当前列表暂无作者数据', 'No author data in this result set')}</p>}</Panel><Panel className="p-5"><h2 className="mb-4 font-bold text-white">{t('热门版块', 'Popular categories')}</h2><div className="flex flex-wrap gap-2">{categoryStats.map(item => <Badge key={item.name}># {tCat(item.name)} <span className="text-slate-500">{item.count}</span></Badge>)}</div></Panel><Panel className="p-5"><h2 className="mb-4 font-bold text-white">{t('当前列表统计', 'Current result set')}</h2><div className="grid grid-cols-2 gap-3">{[[t('讨论','Posts'),totals.posts],[t('作者','Authors'),totals.authors],[t('浏览','Views'),totals.views],[t('回复','Replies'),totals.comments]].map(([label,value]) => <div key={label} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3"><p className="nq-number text-lg font-black text-white">{value.toLocaleString()}</p><p className="mt-1 text-[11px] text-slate-600">{label}</p></div>)}</div><p className="mt-4 text-[11px] leading-5 text-slate-600">{t('统计只覆盖当前已加载的筛选结果，不代表全站累计值。', 'Statistics cover only the currently loaded and filtered results.')}</p></Panel></aside>;
}

function NewsBriefings({ items, t }) {
  return <section aria-labelledby="forum-briefings-title" className="mb-5 space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">{t('市场雷达 · 官方来源', 'Market radar · sources')}</p><h2 id="forum-briefings-title" className="mt-1 text-xl font-black text-white">{t('重要新闻', 'Key news')}</h2></div><span className="text-xs text-slate-500">{t('更新时间', 'Updated')} · {items.updatedAt || '—'} · {t('请以来源页面为准', 'Check source pages for updates')}</span></div>
    <div className="grid gap-3 lg:grid-cols-3">{items.news.map((item, index) => <article key={`${item.url}-${index}`} className="rounded-xl border border-slate-800 bg-slate-900/55 p-4"><div className="flex items-center justify-between gap-2"><Badge variant="primary">{t(item.region, item.regionEn)}</Badge><time className="text-[11px] text-slate-500" dateTime={item.date}>{item.date}</time></div><h3 className="mt-3 text-sm font-bold leading-6 text-white">{t(item.title, item.titleEn)}</h3><p className="mt-2 text-xs leading-5 text-slate-400">{t(item.summary, item.summaryEn)}</p><a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex text-xs font-semibold text-cyan-300 underline decoration-cyan-800 underline-offset-4 hover:text-cyan-200">{t(item.source, item.sourceEn)} ↗</a></article>)}</div>
  </section>;
}

function DocumentLibrary({ items, t }) {
  return <section className="space-y-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">{t('研究资料', 'Research resources')}</p><h2 className="mt-1 text-xl font-black text-white">{t('文档与官方参考', 'Documents & references')}</h2></div><div className="grid gap-3 md:grid-cols-2">{items.documents.map((item, index) => <a key={`${item.url}-${index}`} href={item.url} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-slate-800 bg-slate-900/55 p-5 transition hover:border-cyan-400/40"><h3 className="font-bold text-white">{t(item.title, item.titleEn)} ↗</h3><p className="mt-2 text-sm leading-6 text-slate-400">{t(item.description, item.descriptionEn)}</p></a>)}</div>{items.documents.length === 0 && <EmptyState icon={Search} title={t('暂无资料', 'No documents yet')} description={t('管理员可以在后台添加研究资料链接。', 'An administrator can add resource links in settings.')} />}</section>;
}

function StrategyLibrary({ items, t }) {
  return <section className="rounded-xl border border-violet-400/15 bg-violet-400/[0.035] p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">{t('研究方法', 'Research methods')}</p><h2 className="mt-1 font-bold text-slate-100">{t('策略类型速览', 'Strategy playbook')}</h2></div><span className="text-[11px] text-slate-500">{t('教育与研究用途，不构成投资建议或收益承诺', 'For education and research; not investment advice or a return promise')}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{items.strategies.map((item, index) => <article key={`${item.title}-${index}`} className="rounded-lg border border-slate-800/80 bg-slate-950/45 p-4"><h3 className="text-sm font-semibold text-violet-200">{t(item.title, item.titleEn)}</h3><p className="mt-2 text-xs leading-5 text-slate-400">{t(item.detail, item.detailEn)}</p></article>)}</div>{items.strategies.length === 0 && <EmptyState icon={TrendingUp} title={t('暂无策略资料', 'No strategy notes yet')} description={t('管理员可以在后台维护策略类型速览。', 'An administrator can maintain strategy notes in settings.')} />}</section>;
}
function ForumList(props) {
  const { categories, setActiveCategory, setForumView, fetchForumPosts, forumSort, activeCategory, tCat, user, setAuthModal, setNewPost, newPost, dynamicCats, setForumSort, forumPosts, openPostDetail, handlePinPost, handleDeletePost, t } = props;
  const communityContent = props.communityContent || DEFAULT_COMMUNITY_CONTENT;
  const [section, setSection] = useState('community');
  const [query, setQuery] = useState('');
  const needle = query.trim().toLocaleLowerCase();
  const filteredPosts = useMemo(() => needle ? forumPosts.filter(post => [post.title, post.content, post.author, post.category].some(value => String(value || '').toLocaleLowerCase().includes(needle))) : forumPosts, [forumPosts, needle]);
  const authors = useMemo(() => Object.values(forumPosts.reduce((index, post) => { const key = post.author || t('未知作者', 'Unknown'); const current = index[key] || { name: key, avatar: post.avatar_url, posts: 0, comments: 0 }; current.posts += 1; current.comments += Number(post.comment_count || 0); index[key] = current; return index; }, {})).sort((a, b) => (b.posts + b.comments) - (a.posts + a.comments)), [forumPosts, t]);
  const categoryStats = useMemo(() => Object.entries(forumPosts.reduce((index, post) => { index[post.category] = (index[post.category] || 0) + 1; return index; }, {})).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count), [forumPosts]);
  const totals = useMemo(() => ({ posts: filteredPosts.length, authors: new Set(filteredPosts.map(post => post.author)).size, views: filteredPosts.reduce((sum, post) => sum + Number(post.views || 0), 0), comments: filteredPosts.reduce((sum, post) => sum + Number(post.comment_count || 0), 0) }), [filteredPosts]);
  const hero = filteredPosts.find(post => post.is_pinned) || filteredPosts[0];
  const feed = hero ? filteredPosts.filter(post => post.id !== hero.id) : filteredPosts;
  const create = () => { if (!user) return setAuthModal('login'); setForumView('create'); setNewPost({ ...newPost, category: dynamicCats[0] || categories.find(category => category !== '全部') || '全部' }); };
  return <div className="flex min-h-[calc(100vh-76px)] bg-[#060c13]"><ForumNavigation {...{ categories, activeCategory, tCat, t, authors }} onCategory={category => { setActiveCategory(category); setForumView('list'); fetchForumPosts(category, forumSort); }} onCreate={create} /><main className="min-w-0 flex-1 px-4 py-5 md:px-6"><div className="mx-auto max-w-5xl"><header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center"><div role="tablist" aria-label={t('社区内容栏目', 'Community sections')} className="flex items-center gap-6 text-sm font-bold">{[['community',t('社区','Community')],['documents',t('文档','Docs')],['strategies',t('策略库','Strategies')]].map(([value,label]) => <button key={value} type="button" role="tab" aria-selected={section===value} onClick={() => setSection(value)} className={`pb-3 transition-colors ${section===value ? 'border-b-2 border-cyan-400 text-cyan-300' : 'text-slate-500 hover:text-white'}`}>{label}</button>)}</div>{section === 'community' && <><label className="relative lg:ml-auto lg:w-96"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('搜索当前讨论、作者或关键词…', 'Search loaded discussions, authors or keywords…')} className="w-full rounded-lg border border-slate-700/70 bg-slate-950/75 py-2.5 pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/70" /></label><Button variant="primary" icon={PenLine} onClick={create}>{t('发布讨论', 'New discussion')}</Button></>}</header>{section === 'community' && <><NewsBriefings items={communityContent} t={t} /><StrategyLibrary items={communityContent} t={t} /><CommunityHero post={hero} {...{ t, tCat, openPostDetail }} /><div className="mt-5 flex items-end justify-between gap-4"><Tabs items={sorts(t)} value={forumSort} onChange={value => { setForumSort(value); fetchForumPosts(activeCategory, value); }} label={t('讨论排序', 'Discussion sort')} /><span className="hidden pb-3 text-xs text-slate-600 md:block">{tCat(activeCategory)} · {filteredPosts.length} {t('条结果', 'results')}</span></div>{forumSort === 'hot' && <p className="mt-3 text-xs leading-5 text-slate-600">{t('热门排序由去重浏览、有效评论、置顶权重和发布时间衰减共同计算。', 'Popularity combines deduplicated views, visible comments, pin weight and time decay.')}</p>}<div className="mt-4 space-y-3">{feed.map(post => <PostCard key={post.id} {...{ post, user, t, tCat, openPostDetail, handlePinPost, handleDeletePost }} />)}{filteredPosts.length === 0 && <EmptyState icon={Search} title={t('没有匹配的讨论', 'No matching discussions')} description={needle ? t('请缩短关键词或清除搜索条件。', 'Try a shorter keyword or clear the search.') : t('这个版块还没有内容。', 'This category has no discussions yet.')} action={<Button variant="primary" icon={PenLine} onClick={create}>{t('发布讨论', 'New discussion')}</Button>} />}</div></>}{section === 'documents' && <DocumentLibrary items={communityContent} t={t} />}{section === 'strategies' && <StrategyLibrary items={communityContent} t={t} />}</div></main><div className="border-l border-slate-800/80 bg-[#08111a]/55 p-4"><CommunityAside {...{ authors, categoryStats, totals, t, tCat }} /></div></div>;
}

function DetailView(props) {
  const { selectedPost, setForumView, user, t, tCat, forumPosts, products, getUserTitle, handlePinPost, handleDeletePost, handleReport, comments, handlePinComment, handleDeleteComment, commentInput, setCommentInput, isCommenting, submitComment } = props;
  const userBadge = author => getUserTitle(forumPosts.filter(post => post.author === author).length, products.filter(product => product.author === author).length, author === selectedPost.author ? selectedPost.author_role || 'user' : 'user');
  return <div className="mx-auto max-w-4xl px-4 py-8 md:px-6"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><Button variant="ghost" icon={ArrowLeft} onClick={() => setForumView('list')}>{t('返回社区', 'Back to community')}</Button>{user?.role === 'admin' && <div className="flex gap-2"><Button icon={Star} onClick={event => handlePinPost(selectedPost.id, !selectedPost.is_pinned, event)}>{selectedPost.is_pinned ? t('取消置顶', 'Unpin') : t('置顶', 'Pin')}</Button><Button variant="danger" icon={Trash2} onClick={event => handleDeletePost(selectedPost.id, event)}>{t('删除', 'Delete')}</Button></div>}</div><Panel className="p-6 md:p-8"><div className="flex gap-2">{selectedPost.is_pinned && <Badge variant="primary">{t('置顶', 'Pinned')}</Badge>}<Badge variant="violet">{tCat(selectedPost.category)}</Badge></div><h1 className="mt-5 text-2xl font-black leading-tight text-white md:text-3xl">{selectedPost.title}</h1><div className="mt-6 flex items-center gap-4 border-b border-slate-800 pb-6"><div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-slate-700 bg-slate-800 font-bold text-cyan-300"><Avatar source={selectedPost.avatar_url} name={selectedPost.author} size={48} /></div><div><div className="flex items-center gap-2"><b className="text-white">{selectedPost.author}</b><Badge>{userBadge(selectedPost.author).title}</Badge></div><p className="mt-1 text-xs text-slate-600">{new Date(selectedPost.created_at).toLocaleString()} · {selectedPost.views || 0} {t('次浏览', 'views')}</p></div></div><div className="py-7 text-sm leading-8 md:text-base"><FormattedContent content={selectedPost.content} /></div>{selectedPost.attachments?.some(item => item.kind === 'file') && <section className="mt-3 border-t border-slate-800 pt-5"><h2 className="text-sm font-bold text-white">{t('文章附件', 'Article attachments')}</h2><div className="mt-3 space-y-2">{selectedPost.attachments.filter(item => item.kind === 'file').map(item => <a key={item.id} href={item.url} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm text-cyan-200 hover:border-cyan-400/30"><FileText className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 truncate">{item.name}</span><span className="text-xs text-slate-600">{(item.size / 1024).toFixed(0)} KB</span></a>)}</div></section>}{user && user.id !== selectedPost.author_user_id && <Button variant="ghost" size="sm" onClick={() => handleReport('post', selectedPost.id)}>{t('举报此帖', 'Report post')}</Button>}</Panel><Panel className="mt-5 p-6 md:p-8"><h2 className="flex items-center gap-2 text-lg font-bold text-white"><MessageSquare className="h-5 w-5 text-cyan-400" />{t('参与讨论', 'Discussion')} ({comments.length})</h2><div className="my-7 space-y-4">{comments.map(comment => <div key={comment.id} className={`group relative flex gap-3 rounded-xl border p-4 ${comment.is_pinned ? 'border-cyan-400/25 bg-cyan-400/[0.035]' : 'border-slate-800 bg-slate-950/25'}`}><div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-700 bg-slate-800 text-sm font-bold text-cyan-300"><Avatar source={comment.avatar_url} name={comment.author} size={40} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><b className="text-sm text-white">{comment.author}</b>{comment.author === selectedPost.author && <Badge variant="primary">OP</Badge>}<span className="ml-auto text-[11px] text-slate-600">{new Date(comment.created_at).toLocaleString()}</span></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">{comment.content}</p>{user && user.id !== comment.author_user_id && <button type="button" onClick={() => handleReport('comment', comment.id)} className="mt-3 text-xs text-amber-400">{t('举报评论', 'Report comment')}</button>}</div>{user?.role === 'admin' && <div className="absolute right-3 top-3 flex gap-1 opacity-0 group-hover:opacity-100"><Button size="sm" variant="ghost" onClick={() => handlePinComment(comment.id, !comment.is_pinned)}>{comment.is_pinned ? t('取消置顶', 'Unpin') : t('置顶', 'Pin')}</Button><Button aria-label={t('删除评论', 'Delete comment')} size="icon" variant="danger" onClick={() => handleDeleteComment(comment.id)}><Trash2 className="h-4 w-4" /></Button></div>}</div>)}{comments.length === 0 && <EmptyState icon={MessageSquare} title={t('暂无回复', 'No replies yet')} description={t('成为第一个参与讨论的人。', 'Be the first to join this discussion.')} />}</div><Field label={t('回复内容', 'Your reply')}><textarea rows="5" value={commentInput} onChange={event => setCommentInput(event.target.value)} disabled={!user} placeholder={user ? t('写下你的见解…', 'Share your perspective…') : t('请先登录后回复', 'Sign in to reply')} /></Field><div className="mt-4 flex justify-end"><Button variant="primary" loading={isCommenting} disabled={!user} onClick={submitComment}>{t('发表回复', 'Post reply')}</Button></div></Panel></div>;
}

function CreateView({ categories, newPost, setNewPost, setForumView, submitPost, t, tCat }) {
  const editorRef = useRef(null);
  const imageInputRef = useRef(null);
  const attachmentInputRef = useRef(null);
  const insertionPointRef = useRef(0);
  const [preview, setPreview] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploadError, setUploadError] = useState(false);
  const wordCount = (newPost.content.match(/\p{Script=Han}|[\p{L}\p{N}]+/gu) || []).length;
  const characterCount = newPost.content.length;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem('nexus_forum_post_draft');
        if (saved) {
          const draft = JSON.parse(saved);
          if (draft && typeof draft.title === 'string' && typeof draft.content === 'string') {
            const draftContent = { title: draft.title, category: draft.category, content: draft.content };
            setNewPost(current => ({ ...current, ...draftContent }));
          }
        }
      } catch { /* Ignore unavailable or malformed local drafts. */ }
      setDraftReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [setNewPost]);

  useEffect(() => {
    if (!draftReady) return undefined;
    const timer = window.setTimeout(() => {
      try {
        const savedAt = new Date().toISOString();
        localStorage.setItem('nexus_forum_post_draft', JSON.stringify({ ...newPost, savedAt }));
        setDraftSavedAt(savedAt);
      } catch { setDraftSavedAt(null); }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [draftReady, newPost]);

  const insert = (template, requestedPosition = null) => {
    const field = editorRef.current;
    if (!field) return;
    const start = requestedPosition === null ? field.selectionStart : requestedPosition;
    const end = requestedPosition === null ? field.selectionEnd : requestedPosition;
    const insertion = template;
    setNewPost(current => ({ ...current, content: `${current.content.slice(0, start)}${insertion}${current.content.slice(end)}` }));
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(start + insertion.length, start + insertion.length);
    });
  };

  const uploadFile = async (file, kind) => {
    if (!file) return;
    if ((newPost.attachments || []).length >= 10) { setUploadError(true); setUploadMessage(t('每篇文章最多添加 10 个文件。', 'You can add up to 10 files per post.')); return; }
    setIsUploading(true); setUploadError(false); setUploadMessage(t('正在安全扫描并上传…', 'Scanning and uploading…'));
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiFetch('/api/post-attachments', { method: 'POST', body: formData });
      const data = await response.json();
      const attachment = data.attachment;
      setNewPost(current => ({ ...current, attachments: [...(current.attachments || []), attachment] }));
      if (attachment.kind === 'image') {
        const alt = attachment.name.replace(/[\[\]\n]/g, '').slice(0, 200);
        insert(`![${alt}](${attachment.url})\n`, insertionPointRef.current);
      }
      setUploadMessage(t(`${attachment.name} 已添加`, `${attachment.name} added`));
    } catch (error) {
      setUploadError(true);
      setUploadMessage(error?.message || t('上传失败，请重试。', 'Upload failed. Please try again.'));
    } finally { setIsUploading(false); }
  };

  const removeAttachment = async (attachment) => {
    try {
      await apiFetch('/api/post-attachments', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: attachment.id }) });
      setNewPost(current => ({
        ...current,
        content: current.content.replace(new RegExp(`!\\[[^\\]]*\\]\\(\\/api\\/post-attachments\\?id=${attachment.id}\\)\\n?`, 'g'), ''),
        attachments: (current.attachments || []).filter(item => item.id !== attachment.id),
      }));
    } catch (error) {
      if (error?.status === 404) {
        setNewPost(current => ({ ...current, content: current.content.replace(new RegExp(`!\\[[^\\]]*\\]\\(\\/api\\/post-attachments\\?id=${attachment.id}\\)\\n?`, 'g'), ''), attachments: (current.attachments || []).filter(item => item.id !== attachment.id) }));
        setUploadError(true); setUploadMessage(t('已从草稿移除过期附件。', 'Expired attachment removed from this draft.'));
      } else { setUploadError(true); setUploadMessage(error?.message || t('无法删除附件。', 'Could not remove the attachment.')); }
    }
  };

  const saveDraft = () => {
    try {
      const savedAt = new Date().toISOString();
      localStorage.setItem('nexus_forum_post_draft', JSON.stringify({ ...newPost, savedAt }));
      setDraftSavedAt(savedAt);
    } catch { setDraftSavedAt(null); }
  };
  const publish = async () => {
    const published = await submitPost();
    if (published) {
      localStorage.removeItem('nexus_forum_post_draft');
      setDraftSavedAt(null);
    }
  };

  return <div className="mx-auto max-w-7xl px-4 py-7 md:px-6">
    <input ref={imageInputRef} type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" className="hidden" onChange={event => { void uploadFile(event.target.files?.[0], 'image'); event.target.value = ''; }} />
    <input ref={attachmentInputRef} type="file" accept=".pdf,.csv,.txt,application/pdf,text/csv,text/plain" className="hidden" onChange={event => { void uploadFile(event.target.files?.[0], 'file'); event.target.value = ''; }} />
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><Button variant="ghost" icon={ArrowLeft} onClick={() => setForumView('list')}>{t('返回社区', 'Back to community')}</Button><span className="text-xs text-slate-500">{draftSavedAt ? t(`草稿已保存 ${new Date(draftSavedAt).toLocaleTimeString()}`, `Draft saved ${new Date(draftSavedAt).toLocaleTimeString()}`) : t('草稿仅保存在此设备', 'Draft stays on this device')}</span></div>
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        <Panel className="p-5 md:p-7"><div className="mb-5 flex items-start justify-between gap-4"><div><Badge variant="primary">{t('新讨论', 'New discussion')}</Badge><h1 className="mt-3 text-2xl font-black text-white">{t('撰写社区文章', 'Write a community article')}</h1><p className="mt-2 text-sm leading-6 text-slate-500">{t('用清晰结构分享研究、经验和可复现细节。', 'Share research and reproducible experience with a clear structure.')}</p></div><div className="hidden rounded-xl border border-cyan-400/15 bg-cyan-400/[0.04] p-3 text-right sm:block"><p className="text-[10px] uppercase tracking-wider text-slate-500">{t('正文长度', 'Body length')}</p><p className="mt-1 font-mono text-sm font-bold text-cyan-300">{wordCount} {t('字词', 'words/chars')}</p></div></div>
          <Field label={t('文章标题', 'Article title')} required><input maxLength={200} value={newPost.title} onChange={event => setNewPost({ ...newPost, title: event.target.value })} placeholder={t('例如：如何验证一个稳健的黄金策略', 'e.g. How to validate a robust gold strategy')} className="text-lg font-semibold" /></Field>
          <div className="mt-5 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/55"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/55 px-3 py-2"><div className="flex flex-wrap gap-1">{[[Heading2,'标题','\n\n## 小标题\n\n'],[Bold,'加粗',' **重点内容** '],[Quote,'引用','\n> 引用内容\n'],[List,'列表','\n- 列表项目\n']].map(([Icon,label,snippet]) => <button key={label} type="button" onClick={() => insert(snippet)} aria-label={t(`插入${label}`, `Insert ${label}`)} className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-cyan-200"><Icon className="h-4 w-4" /><span>{t(label, label)}</span></button>)}<span className="mx-1 h-6 w-px bg-slate-700" />{[[ImagePlus,'插入图片',imageInputRef,'image'],[Paperclip,'添加附件',attachmentInputRef,'file']].map(([Icon,label,inputRef,kind]) => <button key={kind} type="button" disabled={isUploading || (newPost.attachments || []).length >= 10} onClick={() => { insertionPointRef.current = editorRef.current?.selectionStart ?? newPost.content.length; inputRef.current?.click(); }} className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-400/10 disabled:opacity-40"><Icon className="h-4 w-4" /><span>{t(label, kind === 'image' ? 'Insert image' : 'Add attachment')}</span></button>)}</div><button type="button" onClick={() => setPreview(value => !value)} className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-400/10">{preview ? <PenLine className="h-4 w-4" /> : <Eye className="h-4 w-4" />}{preview ? t('继续编辑', 'Edit') : t('预览', 'Preview')}</button></div>
            {preview ? <div className="min-h-[420px] p-5 md:p-7"><h2 className="mb-5 text-xl font-black text-white">{newPost.title || t('文章标题预览', 'Article title preview')}</h2><FormattedContent content={newPost.content || t('正文预览会显示在这里。', 'Your article preview will appear here.')} /></div> : <textarea ref={editorRef} maxLength={20_000} rows={18} value={newPost.content} onChange={event => setNewPost({ ...newPost, content: event.target.value })} placeholder={t('开始写作… 可使用工具插入标题、引用、项目符号和重点文本。\n\n推荐结构：\n## 研究背景\n## 方法与参数\n## 验证结果\n## 风险与局限', 'Start writing… Use the toolbar for headings, quotes, bullets and emphasis.\n\nSuggested structure:\n## Research context\n## Method and parameters\n## Validation results\n## Risks and limitations')} className="min-h-[420px] w-full resize-y border-0 bg-transparent px-5 py-5 font-mono text-sm leading-7 text-slate-200 outline-none placeholder:text-slate-700 focus:ring-0 md:px-7" />}
            <div className="flex items-center justify-between border-t border-slate-800 px-4 py-2 text-[11px] text-slate-600"><span>{t('支持标题、引用、列表与加粗；仅接受纯文本格式，不执行 HTML。', 'Headings, quotes, lists and bold are supported; HTML is not executed.')}</span><span>{characterCount.toLocaleString()} / 20,000</span></div>
          </div>
        </Panel>
        <Panel className="p-5"><h2 className="font-bold text-white">{t('发布前检查', 'Before you publish')}</h2><div className="mt-4 grid gap-3 sm:grid-cols-3">{[[newPost.title.trim().length >= 8, '标题清晰', 'Clear title'], [wordCount >= 30, '正文不少于 30 字词', 'At least 30 words or characters'], [newPost.content.includes('##'), '包含分段结构', 'Has sections']].map(([ok, zh, en]) => <div key={zh} className={`rounded-lg border px-3 py-3 text-xs ${ok ? 'border-emerald-500/20 bg-emerald-500/[0.04] text-emerald-300' : 'border-slate-800 bg-slate-950/30 text-slate-500'}`}><span className="mr-2">{ok ? '✓' : '○'}</span>{t(zh, en)}</div>)}</div></Panel>
      </div>
      <aside className="space-y-5 xl:sticky xl:top-24">
        <Panel className="p-5"><div className="flex items-center justify-between"><h2 className="font-bold text-white">{t('发布', 'Publish')}</h2><Badge variant="warning">{t('待发布', 'Draft')}</Badge></div><p className="mt-3 text-xs leading-5 text-slate-500">{t('提交后将发布到所选社区版块，其他用户可以阅读和评论。', 'Publishing makes this post visible in the selected community category.')}</p><div className="mt-5 space-y-3"><Button className="w-full" icon={Save} onClick={saveDraft}>{t('保存本地草稿', 'Save local draft')}</Button><Button variant="primary" className="w-full" icon={Send} disabled={!newPost.title.trim() || !newPost.content.trim()} onClick={publish}>{t('发布讨论', 'Publish post')}</Button></div><p className="mt-3 text-center text-[11px] text-slate-600">{t('未点击发布前不会对其他用户可见。', 'Only you can see it until published.')}</p></Panel>
        <Panel className="p-5"><h2 className="font-bold text-white">{t('文章设置', 'Post settings')}</h2><div className="mt-4"><Field label={t('社区版块', 'Community category')} required><select value={newPost.category} onChange={event => setNewPost({ ...newPost, category: event.target.value })}>{categories.filter(category => category !== '全部').map(category => <option key={category} value={category}>{tCat(category)}</option>)}</select></Field></div><div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/35 p-3 text-xs leading-5 text-slate-500"><p className="font-semibold text-slate-300">{t('写作提示', 'Writing tips')}</p><ul className="mt-2 list-disc space-y-1 pl-4"><li>{t('说明市场、周期和测试区间。', 'State market, timeframe and test period.')}</li><li>{t('注明手续费、滑点和样本外验证。', 'Include fees, slippage and out-of-sample checks.')}</li><li>{t('写明策略失效条件与风险。', 'Describe failure conditions and risks.')}</li></ul></div></Panel>
        <Panel className="p-5"><div className="flex items-center justify-between gap-2"><h2 className="font-bold text-white">{t('图片与附件', 'Images & attachments')}</h2><Badge>{(newPost.attachments || []).length}/10</Badge></div><p className="mt-2 text-xs leading-5 text-slate-500">{t('图片最大 2 MB；PDF、CSV、TXT 最大 10 MB。上传内容经过格式检查与安全扫描。', 'Images up to 2 MB; PDF, CSV and TXT up to 10 MB. Files are validated and scanned.')}</p>{uploadMessage && <p role="status" className={`mt-3 text-xs ${uploadError ? 'text-rose-300' : 'text-emerald-300'}`}>{uploadMessage}</p>}{isUploading && <p className="mt-3 animate-pulse text-xs text-cyan-300">{t('安全扫描中…', 'Security scan in progress…')}</p>}<div className="mt-3 space-y-2">{(newPost.attachments || []).map(attachment => <div key={attachment.id} className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/35 p-2">{attachment.kind === 'image' ? <ImagePlus className="h-4 w-4 shrink-0 text-cyan-300" /> : <FileText className="h-4 w-4 shrink-0 text-violet-300" />}<span className="min-w-0 flex-1 truncate text-xs text-slate-300" title={attachment.name}>{attachment.name}</span><span className="shrink-0 text-[10px] text-slate-600">{(attachment.size / 1024).toFixed(0)} KB</span><button type="button" aria-label={t(`删除附件 ${attachment.name}`, `Remove ${attachment.name}`)} disabled={isUploading} onClick={() => removeAttachment(attachment)} className="rounded p-1 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-40"><X className="h-4 w-4" /></button></div>)}</div>{!(newPost.attachments || []).length && <p className="mt-3 text-xs text-slate-600">{t('尚未添加图片或附件。', 'No images or attachments added yet.')}</p>}</Panel>
      </aside>
    </div>
  </div>;
}

export default function ForumView({ products, handlePinPost, handlePinComment, handleReport, ...props }) {
  const viewProps = { ...props, products, handlePinPost, handlePinComment, handleReport };
  if (props.forumView === 'detail' && props.selectedPost) return <DetailView {...viewProps} />;
  if (props.forumView === 'create') return <CreateView {...viewProps} />;
  return <ForumList {...viewProps} />;
}
