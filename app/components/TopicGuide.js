import Link from 'next/link';
import TopicPageFrame from './TopicPageFrame';

export default function TopicGuide({ kind, title, intro, sections, settings, posts }) {
  const gold = kind === 'gold';
  const marketUrl = gold ? '/?route=market&pair=XAUUSD' : '/?route=market';
  return <TopicPageFrame settings={settings}>
    <main className="topic-guide nq-readable mx-auto w-full max-w-[1380px] px-4 py-7 sm:px-6">
      <nav aria-label="面包屑" className="mb-5 flex flex-wrap gap-2 text-sm text-slate-400"><Link href="/?route=home">首页</Link><span aria-hidden="true">/</span><span aria-current="page">{gold ? '黄金研究专区' : 'MT5 使用指南'}</span></nav>
      <header className={`topic-guide-hero ${gold ? 'topic-guide-gold' : 'topic-guide-mt5'}`}>
        <p className="text-sm font-bold tracking-wide">{gold ? 'XAUUSD · 黄金交易研究' : 'MT5 · EA 策略与验证资料'}</p>
        <h1 className="mt-4 text-3xl font-black leading-tight md:text-4xl">{title}</h1>
        <p className="mt-5 max-w-3xl text-base leading-8">{intro}</p>
        <Link href={marketUrl} className="topic-market-link mt-6 inline-flex rounded-lg px-5 py-3 text-sm font-bold">{gold ? '查看 XAUUSD 黄金策略' : '浏览 MT5 EA 策略市场'} →</Link>
      </header>
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label="专题目录" className="topic-guide-toc rounded-xl border border-slate-700 bg-slate-900/65 p-5 lg:sticky lg:top-24"><h2 className="text-base font-bold text-white">本页目录</h2><ol className="mt-3 space-y-2">{sections.map(section => <li key={section.id}><a href={`#${section.id}`} className="block py-2 text-sm text-slate-300 hover:text-cyan-300">{section.title}</a></li>)}<li><a href="#related-reading" className="block py-2 text-sm text-slate-300">相关文章与资料</a></li></ol></nav>
        <article className="min-w-0 space-y-5">{sections.map(section => <section id={section.id} key={section.id} className="topic-guide-section rounded-xl border border-slate-700 bg-slate-900/65 p-5 sm:p-7"><h2 className="text-xl font-bold text-white">{section.title}</h2>{section.text && <p className="mt-4 text-base leading-8 text-slate-300">{section.text}</p>}{section.items && <ul className="mt-4 list-disc space-y-3 pl-5 text-base leading-8 text-slate-300">{section.items.map(item => <li key={item}>{item}</li>)}</ul>}</section>)}
          <section id="related-reading" className="topic-guide-section rounded-xl border border-slate-700 bg-slate-900/65 p-5 sm:p-7"><h2 className="text-xl font-bold text-white">相关文章与资料</h2>{posts.length ? <ul className="mt-4 divide-y divide-slate-700">{posts.map(post => <li key={post.id} className="py-4"><Link href={`/?route=forum&post=${post.id}`} className="text-base font-semibold text-cyan-300">{post.title} →</Link><p className="mt-2 text-xs text-slate-400">{post.category} · {post.author}</p></li>)}</ul> : <p className="mt-4 text-sm leading-7 text-slate-400">暂无已公开的相关社区文章。您可以先阅读本页资料，或进入社区查看最新讨论。</p>}<div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold text-cyan-300"><Link href={gold ? '/ea-strategies' : '/xauusd-gold-ea'}>{gold ? '阅读 MT5 使用指南' : '阅读黄金研究专区'} →</Link><Link href="/?route=forum">进入开发者社区 →</Link><Link href={marketUrl}>返回策略市场 →</Link></div></section>
        </article>
      </div>
    </main>
  </TopicPageFrame>;
}
