"use client";

import Image from 'next/image';
import Link from 'next/link';
import ShareActions from './ShareActions';
import { NewsBriefings, StrategyLibrary } from './CommunityResources';
import { editorialArticleCover } from './editorialArticleCover';
import './forum-polish.css';
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

function ForumNavigation({ categories, activeCategory, tCat, t, onCategory, onCreate, authors, onSection }) {
  return <aside className="ForumNavigation hidden w-60 shrink-0 border-r border-slate-800/80 bg-[#08111a]/80 xl:flex xl:flex-col">
    <div className="border-b border-slate-800/80 px-5 py-6"><h1 className="text-xl font-black text-white">{t('论坛', 'Forum')}</h1><p className="mt-2 text-xs leading-5 text-slate-500">{t('分享研究、开发经验与真实问题', 'Share research, development experience and real problems')}</p></div>
    <nav aria-label={t('社区版块', 'Community categories')} className="space-y-1 px-3 py-5">{categories.map((category, index) => { const Icon = categoryIcons[index % categoryIcons.length]; const selected = activeCategory === category; return <button key={category} type="button" onClick={() => onCategory(category)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold transition-colors ${selected ? 'bg-cyan-400/10 text-cyan-300 ring-1 ring-inset ring-cyan-400/20' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'}`}><Icon className="h-4 w-4" /><span>{tCat(category)}</span></button>; })}</nav>
    <div className="forum-navigation-resources"><h2>{t('论坛入口', 'Forum resources')}</h2><button onClick={() => onSection('documents')}>{t('文档与官方资料', 'Documents & references')} →</button><button onClick={() => onSection('strategies')}>{t('策略研究资料', 'Strategy research')} →</button><Link href="/xauusd-gold-ea">{t('XAUUSD 黄金研究', 'XAUUSD gold research')} →</Link><Link href="/ea-strategies">{t('MT5 使用指南', 'MT5 guide')} →</Link><Link href="/help">{t('帮助与发帖说明', 'Help & posting guide')} →</Link></div>
    {authors.length > 0 && <div className="border-t border-slate-800/80 px-5 py-5"><div className="mb-4 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{t('本页活跃作者', 'Active here')}</p><Users className="h-4 w-4 text-cyan-400" /></div><div className="space-y-4">{authors.slice(0, 4).map(author => <div key={author.name} className="flex items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-700 bg-slate-800 text-xs font-bold text-cyan-300"><Avatar source={author.avatar} name={author.name} size={36} /></div><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-200">{author.name}</p><p className="text-[11px] text-slate-600">{author.posts} {t('篇讨论', 'posts')}</p></div></div>)}</div></div>}
    <div className="p-4"><Button variant="primary" className="w-full" icon={PenLine} onClick={onCreate}>{t('发布讨论', 'New discussion')}</Button></div>
  </aside>;
}

function CommunityHero({ post, t, tCat, openPostDetail }) {
  if (!post) return null;
  return <Panel interactive className="editorial-community-banner relative overflow-hidden border-cyan-400/20 p-5 md:p-6"><div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(34,211,238,0.16),transparent_38%),linear-gradient(125deg,rgba(15,23,42,0.15),rgba(2,6,23,0.9))]" /><div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(56,189,248,.14)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,.14)_1px,transparent_1px)] [background-size:36px_36px] [mask-image:linear-gradient(to_left,black,transparent)]" /><button type="button" onClick={() => openPostDetail(post)} className="relative z-10 block w-full text-left"><Badge variant="primary">{post.is_pinned ? t('社区置顶', 'Community pinned') : tCat(post.category)}</Badge><h2 className="mt-4 max-w-3xl text-xl font-black leading-snug text-white md:text-2xl">{post.title}</h2><p className="mt-3 max-w-3xl line-clamp-2 text-sm leading-6 text-slate-400">{post.content}</p><div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500"><span>{post.author}</span><span>{new Date(post.created_at).toLocaleDateString()}</span><span className="flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" />{post.views || 0}</span><span className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" />{post.comment_count || 0}</span></div></button></Panel>;
}

function PostCover({ post }) {
  const [failed, setFailed] = useState(false);
  const match = String(post.content || '').match(/^!\[[^\]\n]{0,200}\]\((\/api\/post-attachments\?id=[1-9]\d*)\)$/m);
  const source = !failed && match ? match[1] : `/images/editorial/article-${editorialArticleCover(post)}.webp`;
  return <div className="forum-post-cover"><Image src={source} alt="" width={128} height={96} sizes="(max-width: 767px) 76px, 128px" unoptimized={Boolean(!failed && match)} onError={() => setFailed(true)} /></div>;
}

function PostCard({ post, user, t, tCat, openPostDetail, handlePinPost, handleDeletePost }) {
  return <Panel interactive as="article" className="forum-post-card group relative"><button type="button" className="forum-post-body w-full text-left" onClick={() => openPostDetail(post)}><PostCover post={post}/><div className="forum-post-copy"><div className="mb-2 flex flex-wrap items-center gap-2"><Badge variant={post.is_pinned ? 'primary' : 'violet'}>{post.is_pinned ? t('置顶', 'Pinned') : tCat(post.category)}</Badge>{post.author_role === 'admin' && <ShieldCheck className="h-4 w-4 text-cyan-400"/>}</div><h2 className="text-white group-hover:text-cyan-300">{post.title}</h2><p className="line-clamp-2 text-slate-400">{String(post.content || '').replace(/!\[[^\]]*\]\([^)]*\)/g, '')}</p><div className="forum-post-meta text-slate-400"><span>{post.author}</span><time dateTime={post.created_at}>{new Date(post.created_at).toLocaleDateString()}</time><span className="inline-flex items-center gap-1"><MessageSquare size={14}/>{post.comment_count || 0}</span><span className="inline-flex items-center gap-1"><Eye size={14}/>{post.views || 0}</span></div></div></button>{user?.role === 'admin' && <div className="forum-post-admin absolute right-3 top-3 flex gap-1"><Button aria-label={post.is_pinned ? t('取消置顶', 'Unpin') : t('置顶', 'Pin')} size="icon" variant="ghost" onClick={event => handlePinPost(post.id, !post.is_pinned, event)}><Star className="h-4 w-4"/></Button><Button aria-label={t('删除帖子', 'Delete post')} size="icon" variant="danger" onClick={event => handleDeletePost(post.id, event)}><Trash2 className="h-4 w-4"/></Button></div>}</Panel>;
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

function CommunityAside({ authors, categoryStats, totals, t, tCat, posts, openPostDetail }) {
  return <aside className="CommunityAside hidden w-72 shrink-0 space-y-4 2xl:block"><Panel className="p-5"><h2 className="mb-4 font-bold">{t('本页热门讨论', 'Popular on this page')}</h2><div className="forum-sidebar-posts">{[...posts].sort((a,b) => (Number(b.views||0)+Number(b.comment_count||0)*5)-(Number(a.views||0)+Number(a.comment_count||0)*5)).slice(0,4).map(post => <button key={post.id} onClick={() => openPostDetail(post)}><strong>{post.title}</strong><small>{post.views || 0} {t('浏览', 'views')} · {post.comment_count || 0} {t('回复', 'replies')}</small></button>)}{!posts.length && <p>{t('本页暂无讨论', 'No discussions on this page')}</p>}</div></Panel><Panel className="p-5"><h2 className="mb-5 font-bold text-white">{t('本页活跃作者', 'Active authors')}</h2><div className="space-y-4">{authors.slice(0, 5).map((author, index) => <div key={author.name} className="flex items-center gap-3"><span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${index < 3 ? 'bg-cyan-400/10 text-cyan-300' : 'bg-slate-800 text-slate-500'}`}>{index + 1}</span><div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-700 bg-slate-800 text-xs font-bold text-cyan-300"><Avatar source={author.avatar} name={author.name} size={36} /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-200">{author.name}</p><p className="text-[11px] text-slate-600">{author.posts} {t('篇 · ', 'posts · ')}{author.comments} {t('条回复', 'replies')}</p></div></div>)}</div>{authors.length === 0 && <p className="text-sm text-slate-600">{t('当前列表暂无作者数据', 'No author data in this result set')}</p>}</Panel><Panel className="p-5"><h2 className="mb-4 font-bold text-white">{t('热门版块', 'Popular categories')}</h2><div className="flex flex-wrap gap-2">{categoryStats.map(item => <Badge key={item.name}># {tCat(item.name)} <span className="text-slate-500">{item.count}</span></Badge>)}</div></Panel><Panel className="p-5"><h2 className="mb-4 font-bold text-white">{t('本页讨论统计', 'This page')}</h2><div className="editorial-stat-grid grid grid-cols-2 gap-3">{[[t('讨论','Posts'),totals.posts],[t('作者','Authors'),totals.authors],[t('浏览','Views'),totals.views],[t('回复','Replies'),totals.comments]].map(([label,value]) => <div key={label} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3"><p className="nq-number text-lg font-black text-white">{value.toLocaleString()}</p><p className="mt-1 text-[11px] text-slate-600">{label}</p></div>)}</div><p className="mt-4 text-[11px] leading-5 text-slate-600">{t('作者、浏览和回复仅统计本页，非全站累计。', 'Authors, views and replies cover this page only.')}</p></Panel></aside>;
}

function DocumentLibrary({ items, t }) {
  return <section className="space-y-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">{t('研究资料', 'Research resources')}</p><h2 className="mt-1 text-xl font-black text-white">{t('文档与官方参考', 'Documents & references')}</h2></div><div className="grid gap-3 md:grid-cols-2">{items.documents.map((item, index) => <a key={`${item.url}-${index}`} href={item.url} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-slate-800 bg-slate-900/55 p-5 transition hover:border-cyan-400/40"><h3 className="font-bold text-white">{t(item.title, item.titleEn)} ↗</h3><p className="mt-2 text-sm leading-6 text-slate-400">{t(item.description, item.descriptionEn)}</p></a>)}</div>{items.documents.length === 0 && <EmptyState icon={Search} title={t('暂无资料', 'No documents yet')} description={t('管理员可以在后台添加研究资料链接。', 'An administrator can add resource links in settings.')} />}</section>;
}

function ForumList(props) {
  const { categories, setActiveCategory, setForumView, fetchForumPosts, forumSort, activeCategory, tCat, user, setAuthModal, setNewPost, newPost, dynamicCats, setForumSort, forumPosts, openPostDetail, handlePinPost, handleDeletePost, t, forumQuery = '', setForumQuery, forumLoading, forumError } = props;
  const communityContent = props.communityContent || DEFAULT_COMMUNITY_CONTENT;
  const pagination = props.forumPagination || { page: 1, totalPages: 1, total: forumPosts.length };
  const [section, setSection] = useState('community');
  const [query, setQuery] = useState(forumQuery);
  const listTop = useRef(null);
  const authors = useMemo(() => Object.values(forumPosts.reduce((index, post) => { const key = post.author || t('未知作者', 'Unknown'); const current = index[key] || { name: key, avatar: post.avatar_url, posts: 0, comments: 0 }; current.posts += 1; current.comments += Number(post.comment_count || 0); index[key] = current; return index; }, {})).sort((a,b) => (b.posts+b.comments)-(a.posts+a.comments)), [forumPosts, t]);
  const categoryStats = useMemo(() => Object.entries(forumPosts.reduce((index, post) => { index[post.category] = (index[post.category] || 0) + 1; return index; }, {})).map(([name,count]) => ({name,count})), [forumPosts]);
  const totals = { posts: forumPosts.length, authors: authors.length, views: forumPosts.reduce((sum,post) => sum+Number(post.views||0),0), comments: forumPosts.reduce((sum,post) => sum+Number(post.comment_count||0),0) };
  const hero = forumPosts.find(post => post.is_pinned) || forumPosts[0];
  const feed = hero ? forumPosts.filter(post => post.id !== hero.id) : forumPosts;
  const create = () => { if (!user) return setAuthModal('login'); setForumView('create'); setNewPost({ ...newPost, category: dynamicCats[0] || categories.find(category => category !== '全部') || '全部' }); };
  const pageTo = page => { fetchForumPosts(activeCategory,forumSort,page,forumQuery); listTop.current?.scrollIntoView({block:'start',behavior:'instant'}); };
  const chooseCategory = category => { setActiveCategory(category); setForumView('list'); setSection('community'); fetchForumPosts(category,forumSort,1,forumQuery); };
  return <div className="forum-layout bg-[#060c13]">
    <ForumNavigation {...{categories,activeCategory,tCat,t,authors}} onCategory={chooseCategory} onCreate={create} onSection={setSection}/>
    <main className="forum-main min-w-0"><header className="forum-list-header"><div role="tablist" aria-label={t('论坛栏目','Forum sections')} className="flex gap-5 text-sm font-bold">{[['community',t('论坛','Forum')],['documents',t('文档','Docs')],['strategies',t('策略库','Strategies')]].map(([value,label]) => <button key={value} type="button" role="tab" aria-selected={section===value} onClick={() => setSection(value)} className={`pb-3 ${section===value?'border-b-2 border-cyan-400 text-cyan-300':'text-slate-500'}`}>{label}</button>)}</div>
    {section==='community' && <><form className="forum-search" onSubmit={event => {event.preventDefault();setForumQuery(query.trim());fetchForumPosts(activeCategory,forumSort,1,query.trim());}}><label className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"/><input maxLength={200} value={query} onChange={event => setQuery(event.target.value)} aria-label={t('搜索论坛','Search forum')} placeholder={t('搜索帖子、作者或关键词…','Search posts, authors or keywords…')} className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-3 text-sm"/></label><Button type="submit" disabled={forumLoading}>{t('搜索','Search')}</Button></form><Button variant="primary" icon={PenLine} onClick={create}>{t('发布讨论','New discussion')}</Button></>}</header>
    {section==='community' && <>{props.forumNewsEnabled!==false && <NewsBriefings items={communityContent} t={t}/>} {props.forumStrategyOverviewEnabled!==false && <StrategyLibrary items={communityContent} t={t}/>}
    <div className="forum-feed-top" ref={listTop}><div className="forum-mobile-categories xl:hidden"><label>{t('版块','Category')}<select value={activeCategory} onChange={event => chooseCategory(event.target.value)}>{categories.map(category => <option key={category} value={category}>{tCat(category)}</option>)}</select></label></div><Tabs items={sorts(t)} value={forumSort} onChange={value => {setForumSort(value);fetchForumPosts(activeCategory,value,1,forumQuery);}} label={t('讨论排序','Discussion sort')}/><p className="text-sm text-slate-500" aria-live="polite">{forumLoading?t('正在读取帖子…','Loading posts…'):t(`共 ${pagination.total} 条 · 第 ${pagination.page} / ${pagination.totalPages} 页`,` ${pagination.total} posts · Page ${pagination.page} / ${pagination.totalPages}`)}</p></div>
    {forumSort==='hot' && <p className="my-3 text-xs text-slate-500">{t('热门排序综合浏览、有效评论、置顶和时间衰减。','Popularity combines views, visible replies, pins and time decay.')}</p>}
    {forumError ? <Panel className="p-5" role="alert"><p>{forumError}</p><Button onClick={() => pageTo(pagination.page)}>{t('重试','Retry')}</Button></Panel> : <div aria-busy={forumLoading} className="forum-feed"><CommunityHero post={hero} {...{t,tCat,openPostDetail}}/><div className="mt-4 space-y-3">{feed.map(post => <PostCard key={post.id} {...{post,user,t,tCat,openPostDetail,handlePinPost,handleDeletePost}}/>)}{!forumLoading && forumPosts.length===0 && <EmptyState icon={Search} title={t('没有匹配的讨论','No matching discussions')} description={t('请调整搜索或版块，也可以发布新讨论。','Change the search or category, or start a discussion.')} action={<Button onClick={create}>{t('发布讨论','New discussion')}</Button>}/>}</div></div>}
    <nav className="forum-pagination" aria-label={t('帖子分页','Post pagination')}><span>{t('每页 12 条','12 posts per page')}</span><Button disabled={forumLoading||pagination.page<=1} onClick={() => pageTo(pagination.page-1)}>{t('上一页','Previous')}</Button><span aria-live="polite">{pagination.page} / {pagination.totalPages}</span><Button disabled={forumLoading||pagination.page>=pagination.totalPages} onClick={() => pageTo(pagination.page+1)}>{t('下一页','Next')}</Button></nav></>}
    {section==='documents' && <DocumentLibrary items={communityContent} t={t}/>} {section==='strategies' && <StrategyLibrary items={communityContent} t={t} expanded/>}
    </main><div className="forum-right"><CommunityAside {...{authors,categoryStats,totals,t,tCat,openPostDetail}} posts={forumPosts}/></div>
  </div>;
}

function DetailView(props) {
  const { selectedPost, setForumView, user, t, tCat, forumPosts, products, getUserTitle, handlePinPost, handleDeletePost, handleReport, comments, handlePinComment, handleDeleteComment, commentInput, setCommentInput, isCommenting, submitComment } = props;
  const userBadge = author => getUserTitle(forumPosts.filter(post => post.author === author).length, products.filter(product => product.author === author).length, author === selectedPost.author ? selectedPost.author_role || 'user' : 'user');
  return <div className="mx-auto max-w-4xl px-4 py-8 md:px-6"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><Button variant="ghost" icon={ArrowLeft} onClick={() => setForumView('list')}>{t('返回社区', 'Back to community')}</Button>{user?.role === 'admin' && <div className="flex gap-2"><Button icon={Star} onClick={event => handlePinPost(selectedPost.id, !selectedPost.is_pinned, event)}>{selectedPost.is_pinned ? t('取消置顶', 'Unpin') : t('置顶', 'Pin')}</Button><Button variant="danger" icon={Trash2} onClick={event => handleDeletePost(selectedPost.id, event)}>{t('删除', 'Delete')}</Button></div>}</div><Panel className="p-6 md:p-8"><Link href={`/forum/${selectedPost.id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-cyan-300">{t('打开文章分享页 →','Open article page →')}</Link><div className="flex gap-2">{selectedPost.is_pinned && <Badge variant="primary">{t('置顶', 'Pinned')}</Badge>}<Badge variant="violet">{tCat(selectedPost.category)}</Badge></div><h1 className="mt-5 text-2xl font-black leading-tight text-white md:text-3xl">{selectedPost.title}</h1><div className="mt-6 flex items-center gap-4 border-b border-slate-800 pb-6"><div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-slate-700 bg-slate-800 font-bold text-cyan-300"><Avatar source={selectedPost.avatar_url} name={selectedPost.author} size={48} /></div><div><div className="flex items-center gap-2"><b className="text-white">{selectedPost.author}</b><Badge>{userBadge(selectedPost.author).title}</Badge></div><p className="mt-1 text-xs text-slate-600">{new Date(selectedPost.created_at).toLocaleString()} · {selectedPost.views || 0} {t('次浏览', 'views')}</p></div></div><div className="mt-5"><ShareActions title={selectedPost.title} path={`/forum/${selectedPost.id}`} t={t}/></div><div className="py-7 text-sm leading-8 md:text-base"><FormattedContent content={selectedPost.content} /></div><ShareActions title={selectedPost.title} path={`/forum/${selectedPost.id}`} t={t}/>{selectedPost.attachments?.some(item => item.kind === 'file') && <section className="mt-3 border-t border-slate-800 pt-5"><h2 className="text-sm font-bold text-white">{t('文章附件', 'Article attachments')}</h2><div className="mt-3 space-y-2">{selectedPost.attachments.filter(item => item.kind === 'file').map(item => <a key={item.id} href={item.url} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm text-cyan-200 hover:border-cyan-400/30"><FileText className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 truncate">{item.name}</span><span className="text-xs text-slate-600">{(item.size / 1024).toFixed(0)} KB</span></a>)}</div></section>}{user && user.id !== selectedPost.author_user_id && <Button variant="ghost" size="sm" onClick={() => handleReport('post', selectedPost.id)}>{t('举报此帖', 'Report post')}</Button>}</Panel><Panel className="mt-5 p-6 md:p-8"><h2 className="flex items-center gap-2 text-lg font-bold text-white"><MessageSquare className="h-5 w-5 text-cyan-400" />{t('参与讨论', 'Discussion')} ({comments.length})</h2><div className="my-7 space-y-4">{comments.map(comment => <div key={comment.id} className={`group relative flex gap-3 rounded-xl border p-4 ${comment.is_pinned ? 'border-cyan-400/25 bg-cyan-400/[0.035]' : 'border-slate-800 bg-slate-950/25'}`}><div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-700 bg-slate-800 text-sm font-bold text-cyan-300"><Avatar source={comment.avatar_url} name={comment.author} size={40} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><b className="text-sm text-white">{comment.author}</b>{comment.author === selectedPost.author && <Badge variant="primary">OP</Badge>}<span className="ml-auto text-[11px] text-slate-600">{new Date(comment.created_at).toLocaleString()}</span></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">{comment.content}</p>{user && user.id !== comment.author_user_id && <button type="button" onClick={() => handleReport('comment', comment.id)} className="mt-3 text-xs text-amber-400">{t('举报评论', 'Report comment')}</button>}</div>{user?.role === 'admin' && <div className="absolute right-3 top-3 flex gap-1 opacity-0 group-hover:opacity-100"><Button size="sm" variant="ghost" onClick={() => handlePinComment(comment.id, !comment.is_pinned)}>{comment.is_pinned ? t('取消置顶', 'Unpin') : t('置顶', 'Pin')}</Button><Button aria-label={t('删除评论', 'Delete comment')} size="icon" variant="danger" onClick={() => handleDeleteComment(comment.id)}><Trash2 className="h-4 w-4" /></Button></div>}</div>)}{comments.length === 0 && <EmptyState icon={MessageSquare} title={t('暂无回复', 'No replies yet')} description={t('成为第一个参与讨论的人。', 'Be the first to join this discussion.')} />}</div><Field label={t('回复内容', 'Your reply')}><textarea rows="5" value={commentInput} onChange={event => setCommentInput(event.target.value)} disabled={!user} placeholder={user ? t('写下你的见解…', 'Share your perspective…') : t('请先登录后回复', 'Sign in to reply')} /></Field><div className="mt-4 flex justify-end"><Button variant="primary" loading={isCommenting} disabled={!user} onClick={submitComment}>{t('发表回复', 'Post reply')}</Button></div></Panel></div>;
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
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const publishLock = useRef(false);
  const fileLock = useRef(false);
  const busy = isUploading || isPublishing || isRemoving;
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploadError, setUploadError] = useState(false);
  const wordCount = (newPost.content.match(/\p{Script=Han}|[\p{L}\p{N}]+/gu) || []).length;
  const characterCount = newPost.content.length;
  const categoryKey = JSON.stringify(categories);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem('nexus_forum_post_draft');
        if (saved) {
          const draft = JSON.parse(saved);
          if (draft && typeof draft.title === 'string' && typeof draft.content === 'string') {
            const attachments = Array.isArray(draft.attachments) ? draft.attachments.filter(file => Number.isSafeInteger(file?.id) && file.id > 0 && ['image','file'].includes(file.kind) && typeof file.name === 'string' && file.url === `/api/post-attachments?id=${file.id}`).slice(0,10) : [];
            const draftContent = { title: draft.title, category: JSON.parse(categoryKey).includes(draft.category) ? draft.category : JSON.parse(categoryKey).find(item => item !== '全部'), content: draft.content, attachments };
            setNewPost(current => ({ ...current, ...draftContent }));
          }
        }
      } catch { /* Ignore unavailable or malformed local drafts. */ }
      setDraftReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [setNewPost, categoryKey]);

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
    if (!file || fileLock.current || publishLock.current) return;
    if ((newPost.attachments || []).length >= 10) { setUploadError(true); setUploadMessage(t('每篇文章最多添加 10 个文件。', 'You can add up to 10 files per post.')); return; }
    fileLock.current = true;
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
    } finally { fileLock.current = false; setIsUploading(false); }
  };

  const removeAttachment = async (attachment) => {
    if (fileLock.current || publishLock.current) return;
    fileLock.current = true; setIsRemoving(true);
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
    } finally { fileLock.current = false; setIsRemoving(false); }
  };

  const saveDraft = () => {
    try {
      const savedAt = new Date().toISOString();
      localStorage.setItem('nexus_forum_post_draft', JSON.stringify({ ...newPost, savedAt }));
      setDraftSavedAt(savedAt);
    } catch { setDraftSavedAt(null); }
  };
  const publish = async () => {
    if (publishLock.current || fileLock.current || !newPost.title.trim() || !newPost.content.trim()) return;
    publishLock.current = true; setIsPublishing(true);
    try {
      const published = await submitPost();
      if (published) { try { localStorage.removeItem('nexus_forum_post_draft'); } catch {} setDraftSavedAt(null); }
    } finally { publishLock.current = false; setIsPublishing(false); }
  };
  const publishDisabled = busy || !newPost.title.trim() || !newPost.content.trim();

  return <div className="forum-editor-page mx-auto max-w-7xl px-4 py-7 md:px-6" aria-busy={busy}>
    <input ref={imageInputRef} aria-label={t('上传正文图片', 'Upload body image')} disabled={busy} type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" className="hidden" onChange={event => { void uploadFile(event.target.files?.[0], 'image'); event.target.value = ''; }} />
    <input ref={attachmentInputRef} aria-label={t('上传文章附件', 'Upload post attachment')} disabled={busy} type="file" accept=".pdf,.csv,.txt,application/pdf,text/csv,text/plain" className="hidden" onChange={event => { void uploadFile(event.target.files?.[0], 'file'); event.target.value = ''; }} />
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><Button variant="ghost" icon={ArrowLeft} disabled={busy} onClick={() => setForumView('list')}>{t('返回社区', 'Back to community')}</Button><span className="text-xs text-slate-500">{draftSavedAt ? t(`草稿已保存 ${new Date(draftSavedAt).toLocaleTimeString()}`, `Draft saved ${new Date(draftSavedAt).toLocaleTimeString()}`) : t('草稿仅保存在此设备', 'Draft stays on this device')}</span></div>
    <div className="forum-editor-layout grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="forum-editor-main space-y-5">
        <Panel className="p-5 md:p-7"><div className="mb-5 flex items-start justify-between gap-4"><div><Badge variant="primary">{t('新讨论', 'New discussion')}</Badge><h1 className="mt-3 text-2xl font-black text-white">{t('撰写社区文章', 'Write a community article')}</h1><p className="mt-2 text-sm leading-6 text-slate-500">{t('用清晰结构分享研究、经验和可复现细节。', 'Share research and reproducible experience with a clear structure.')}</p></div><div className="editor-word-counter hidden rounded-xl border border-cyan-400/15 bg-cyan-400/[0.04] p-3 text-right sm:block"><p className="text-[10px] uppercase tracking-wider text-slate-500">{t('正文长度', 'Body length')}</p><p className="mt-1 font-mono text-sm font-bold text-cyan-300">{wordCount} {t('字词', 'words/chars')}</p></div></div>
          <Field label={t('文章标题', 'Article title')} required><input disabled={isPublishing} maxLength={200} value={newPost.title} onChange={event => setNewPost({ ...newPost, title: event.target.value })} placeholder={t('例如：如何验证一个稳健的黄金策略', 'e.g. How to validate a robust gold strategy')} className="text-lg font-semibold" /></Field>
          <div className="mt-5 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/55"><div className="forum-editor-toolbar" role="toolbar" aria-label={t('文章编辑工具', 'Article editing tools')}><div className="forum-editor-tools">{[[Heading2,'标题','Heading','\n\n## 小标题\n\n'],[Bold,'加粗','Bold',' **重点内容** '],[Quote,'引用','Quote','\n> 引用内容\n'],[List,'列表','List','\n- 列表项目\n']].map(([Icon,label,en,snippet]) => <button key={label} type="button" disabled={preview || isPublishing} onClick={() => insert(snippet)} aria-label={t(`插入${label}`, `Insert ${en}`)}><Icon/><span>{t(label,en)}</span></button>)}{[[ImagePlus,'插入图片',imageInputRef,'image'],[Paperclip,'添加附件',attachmentInputRef,'file']].map(([Icon,label,inputRef,kind]) => <button key={kind} type="button" disabled={busy || preview || (newPost.attachments || []).length >= 10} onClick={() => { insertionPointRef.current = editorRef.current?.selectionStart ?? newPost.content.length; inputRef.current?.click(); }}><Icon/><span>{t(label, kind === 'image' ? 'Insert image' : 'Add attachment')}</span></button>)}</div><button type="button" disabled={isPublishing} aria-pressed={preview} onClick={() => setPreview(value => !value)}>{preview ? <PenLine/> : <Eye/>}{preview ? t('继续编辑', 'Edit') : t('预览', 'Preview')}</button></div>
            {preview ? <div className="min-h-[420px] p-5 md:p-7"><h2 className="mb-5 text-xl font-black text-white">{newPost.title || t('文章标题预览', 'Article title preview')}</h2><FormattedContent content={newPost.content || t('正文预览会显示在这里。', 'Your article preview will appear here.')} /></div> : <textarea aria-label={t('正文内容', 'Article body')} disabled={isPublishing} ref={editorRef} maxLength={20_000} rows={18} value={newPost.content} onChange={event => setNewPost({ ...newPost, content: event.target.value })} placeholder={t('开始写作… 可使用工具插入标题、引用、项目符号和重点文本。\n\n推荐结构：\n## 研究背景\n## 方法与参数\n## 验证结果\n## 风险与局限', 'Start writing… Use the toolbar for headings, quotes, bullets and emphasis.\n\nSuggested structure:\n## Research context\n## Method and parameters\n## Validation results\n## Risks and limitations')} className="min-h-[420px] w-full resize-y border-0 bg-transparent px-5 py-5 font-mono text-sm leading-7 text-slate-200 outline-none placeholder:text-slate-700 focus:ring-0 md:px-7" />}
            <div className="forum-editor-status border-t border-slate-800 px-4 py-2 text-slate-400"><span>{t('支持标题、引用、列表与加粗；仅接受纯文本格式，不执行 HTML。', 'Headings, quotes, lists and bold are supported; HTML is not executed.')}</span><span>{characterCount.toLocaleString()} / 20,000</span></div>
          </div>
        </Panel>
        <Panel className="p-5"><h2 className="font-bold text-white">{t('写作建议（非发布门槛）', 'Writing suggestions (optional)')}</h2><div className="mt-4 grid gap-3 sm:grid-cols-3">{[[newPost.title.trim().length >= 8, '标题清晰', 'Clear title'], [wordCount >= 30, '正文不少于 30 字词', 'At least 30 words or characters'], [newPost.content.includes('##'), '包含分段结构', 'Has sections']].map(([ok, zh, en]) => <div key={zh} className={`rounded-lg border px-3 py-3 text-xs ${ok ? 'border-emerald-500/20 bg-emerald-500/[0.04] text-emerald-300' : 'border-slate-800 bg-slate-950/30 text-slate-500'}`}><span className="mr-2">{ok ? '✓' : '○'}</span>{t(zh, en)}</div>)}</div></Panel>
      </div>
      <aside className="forum-editor-sidebar space-y-5">
        <Panel className="forum-editor-publish p-5"><div className="flex items-center justify-between"><h2 className="font-bold text-white">{t('发布', 'Publish')}</h2><Badge variant="warning">{t('待发布', 'Draft')}</Badge></div><p className="mt-3 text-xs leading-5 text-slate-500">{t('提交后将发布到所选社区版块，其他用户可以阅读和评论。', 'Publishing makes this post visible in the selected community category.')}</p><div className="mt-5 space-y-3"><Button className="w-full" icon={Save} disabled={isPublishing} onClick={saveDraft}>{t('保存本地草稿', 'Save local draft')}</Button><Button variant="primary" className="w-full" icon={Send} loading={isPublishing} disabled={publishDisabled} onClick={publish}>{t('发布讨论', 'Publish post')}</Button></div><p className="mt-3 text-center text-[11px] text-slate-600">{t('未点击发布前不会对其他用户可见。', 'Only you can see it until published.')}</p></Panel>
        <Panel className="p-5"><h2 className="font-bold text-white">{t('文章设置', 'Post settings')}</h2><div className="mt-4"><Field label={t('社区版块', 'Community category')} required><select disabled={isPublishing} value={newPost.category} onChange={event => setNewPost({ ...newPost, category: event.target.value })}>{categories.filter(category => category !== '全部').map(category => <option key={category} value={category}>{tCat(category)}</option>)}</select></Field></div><div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/35 p-3 text-xs leading-5 text-slate-500"><p className="font-semibold text-slate-300">{t('写作提示', 'Writing tips')}</p><ul className="mt-2 list-disc space-y-1 pl-4"><li>{t('说明市场、周期和测试区间。', 'State market, timeframe and test period.')}</li><li>{t('注明手续费、滑点和样本外验证。', 'Include fees, slippage and out-of-sample checks.')}</li><li>{t('写明策略失效条件与风险。', 'Describe failure conditions and risks.')}</li></ul></div></Panel>
        <Panel className="p-5"><div className="flex items-center justify-between gap-2"><h2 className="font-bold text-white">{t('图片与附件', 'Images & attachments')}</h2><Badge>{(newPost.attachments || []).length}/10</Badge></div><p className="mt-2 text-xs leading-5 text-slate-500">{t('图片最大 2 MB；PDF、CSV、TXT 最大 10 MB。上传内容经过格式检查与安全扫描。', 'Images up to 2 MB; PDF, CSV and TXT up to 10 MB. Files are validated and scanned.')}</p>{uploadMessage && <p role="status" className={`mt-3 text-xs ${uploadError ? 'text-rose-300' : 'text-emerald-300'}`}>{uploadMessage}</p>}{isUploading && <p className="mt-3 animate-pulse text-xs text-cyan-300">{t('安全扫描中…', 'Security scan in progress…')}</p>}<div className="mt-3 space-y-2">{(newPost.attachments || []).map(attachment => <div key={attachment.id} className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/35 p-2">{attachment.kind === 'image' ? <ImagePlus className="h-4 w-4 shrink-0 text-cyan-300" /> : <FileText className="h-4 w-4 shrink-0 text-violet-300" />}<span className="forum-attachment-name min-w-0 flex-1 text-slate-300" title={attachment.name}>{attachment.name}</span><span className="shrink-0 text-[10px] text-slate-600">{(attachment.size / 1024).toFixed(0)} KB</span><button type="button" aria-label={t(`删除附件 ${attachment.name}`, `Remove ${attachment.name}`)} disabled={busy} onClick={() => removeAttachment(attachment)} className="rounded p-1 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-40"><X className="h-4 w-4" /></button></div>)}</div>{!(newPost.attachments || []).length && <p className="mt-3 text-xs text-slate-600">{t('尚未添加图片或附件。', 'No images or attachments added yet.')}</p>}</Panel>
      </aside>
    </div>
    <div className="forum-editor-mobile-actions" aria-label={t('保存与发布', 'Save and publish')}><Button icon={Save} disabled={isPublishing} onClick={saveDraft}>{t('保存草稿', 'Save draft')}</Button><Button variant="primary" icon={Send} loading={isPublishing} disabled={publishDisabled} onClick={publish}>{t('发布讨论', 'Publish post')}</Button></div>
  </div>;
}

export default function ForumView({ products, handlePinPost, handlePinComment, handleReport, ...props }) {
  const viewProps = { ...props, products, handlePinPost, handlePinComment, handleReport };
  if (props.forumView === 'detail' && props.selectedPost) return <DetailView {...viewProps} />;
  if (props.forumView === 'create') return <CreateView {...viewProps} />;
  return <ForumList {...viewProps} />;
}
