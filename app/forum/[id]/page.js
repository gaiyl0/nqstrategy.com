import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getPublicPost } from '@/lib/public-post';
import { forumAccess } from '@/lib/forum-feature';
import db from '@/lib/db';
import { articleSummary, articleHeadings, shareMetadata, siteOrigin } from '@/lib/share-content.mjs';
import { publicSiteSettings } from '@/lib/topic-pages';
import TopicPageFrame from '@/app/components/TopicPageFrame';
import ShareActions from '@/app/components/ShareActions';
import ArticleContent from '@/app/components/ArticleContent';

export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }) {
  const { id } = await params; const post = getPublicPost(id);
  if (!post) return { title: '文章不存在', robots: { index: false, follow: false } };
  return shareMetadata({ title: post.title, description: articleSummary(post.content), path: `/forum/${post.id}`, image: `/api/share-image?type=article&id=${post.id}`, article: true, author: post.author, date: new Date(post.created_at).toISOString() });
}
export default async function ArticlePage({ params }) {
  const { id } = await params; const post = getPublicPost(id); if (!post) notFound();
  const headings = articleHeadings(post.content);
  const related = db.prepare("SELECT id,title FROM posts WHERE category=? AND id<>? AND moderation_status='visible' ORDER BY is_pinned DESC,created_at DESC,id DESC LIMIT 4").all(post.category,post.id);
  const url = `${siteOrigin()}/forum/${post.id}`;
  const jsonLd = { '@context':'https://schema.org','@type':'Article', headline:post.title, description:articleSummary(post.content), author:{ '@type':'Person',name:post.author }, datePublished:new Date(post.created_at).toISOString(), mainEntityOfPage:url, image:`${siteOrigin()}/api/share-image?type=article&id=${post.id}` };
  return <TopicPageFrame settings={publicSiteSettings()}><main className="share-page article-share-page"><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(jsonLd).replace(/</g,'\\u003c')}}/><div className="share-page-container"><nav aria-label="面包屑" className="share-breadcrumb">{forumAccess().enabled ? <Link href="/?route=forum">论坛</Link> : <span>历史文章</span>}<span>/</span><span>{post.category}</span></nav><article><header className="share-cover article-share-cover"><Image src={post.coverUrl} alt="" fill unoptimized sizes="(max-width: 768px) 100vw, 1200px" priority/><div className="share-cover-overlay"/><div className="share-cover-copy"><span className="share-category">{post.category}</span><h1>{post.title}</h1><p>{post.author} · {new Date(post.created_at).toLocaleDateString('zh-CN')}</p></div></header><div className="article-share-layout"><div className="article-share-main"><section className="share-card share-summary"><h2>阅读摘要</h2><p>{articleSummary(post.content,240) || '阅读作者的完整讨论与研究内容。'}</p></section><div className="share-card"><ShareActions title={post.title} path={`/forum/${post.id}`} origin={siteOrigin()}/>{headings.length>0 && <nav aria-label="文章目录" className="article-toc"><h2>文章目录</h2><ol>{headings.map(heading=><li key={heading.id}><a href={`#${heading.id}`}>{heading.title}</a></li>)}</ol></nav>}<section id="article-body" className="article-full-text"><ArticleContent content={post.content} imageIds={post.attachments.filter(item=>item.kind==='image').map(item=>item.id)}/></section>{post.attachments.some(item=>item.kind==='file') && <section className="article-files"><h2>文章附件</h2>{post.attachments.filter(item=>item.kind==='file').map(item=><a key={item.id} href={`/api/post-attachments?id=${item.id}`}>{item.original_name} ↗</a>)}</section>}<p className="share-disclosure">研究资料不构成收益承诺或投资建议，请独立核对资料与风险。</p><ShareActions title={post.title} path={`/forum/${post.id}`} origin={siteOrigin()}/>{forumAccess().enabled ? <Link className="share-primary" href={`/?route=forum&post=${post.id}`}>参与论坛讨论 →</Link> : <p className="share-disclosure">论坛讨论已关闭，本页保留历史阅读。</p>}</div></div><aside className="article-share-aside"><section className="share-card"><h2>继续阅读</h2>{related.length?related.map(item=><Link key={item.id} href={`/forum/${item.id}`}>{item.title} →</Link>):<p>暂无同版块相关文章。</p>}{forumAccess().enabled && <Link href="/?route=forum">返回论坛 →</Link>}<Link href="/xauusd-gold-ea">黄金 EA 研究专区 →</Link><Link href="/ea-strategies">MT5 使用指南 →</Link></section></aside></div></article></div></main></TopicPageFrame>;
}
