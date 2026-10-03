import Link from 'next/link';
import TopicPageFrame from './TopicPageFrame';
import { publicSiteSettings } from '@/lib/topic-pages';
import { supportPages } from '@/lib/support-content';

export function supportMetadata(kind) {
  const page = supportPages[kind];
  return { title: `${page.title} | Nexus Quant`, description: page.description, alternates: { canonical: `/${kind}` }, ...(page.draft ? { robots: { index: false, follow: true } } : {}) };
}

export default function SupportPage({ kind }) {
  const page = supportPages[kind];
  const settings = publicSiteSettings();
  const email = settings.contactEmail || 'admin@nexusquant.com';
  return <TopicPageFrame settings={settings}>
    <main className="topic-guide support-guide nq-readable mx-auto w-full max-w-[1380px] px-4 py-7 sm:px-6">
      <nav aria-label="面包屑" className="mb-5 flex flex-wrap gap-2 text-sm text-slate-400"><Link href="/?route=home">首页</Link><span aria-hidden="true">/</span>{kind !== 'help' && <><Link href="/help">帮助中心</Link><span aria-hidden="true">/</span></>}<span aria-current="page">{page.title}</span></nav>
      <header className="topic-guide-hero topic-guide-mt5"><p className="text-sm font-bold">Nexus Quant · 支持与服务</p><h1 className="mt-4 text-3xl font-black">{page.title}</h1><p className="mt-4 text-base leading-8">{page.description}</p></header>
      {page.draft && <aside className="support-draft mt-5 rounded-xl border p-5 text-sm leading-7"><strong>当前功能说明与草案 · 正式规则待确认</strong><p>本页依据当前网站功能编写。运营主体、数据保存安排及交易细则中的待确认事项尚未形成完整正式政策；不会将未开放能力或未确认承诺列为已生效规则。</p></aside>}
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label="本页目录" className="topic-guide-toc rounded-xl border border-slate-700 bg-slate-900/65 p-5 lg:sticky lg:top-24"><h2 className="text-base font-bold text-white">本页目录</h2><ol className="mt-3 space-y-2">{page.sections.map(section => <li key={section.id}><a href={`#${section.id}`} className="block py-2 text-sm text-slate-300">{section.title}</a></li>)}</ol></nav>
        <article className="min-w-0 space-y-5">{page.sections.map(section => <section id={section.id} key={section.id} className="topic-guide-section rounded-xl border border-slate-700 bg-slate-900/65 p-5 sm:p-7"><h2 className="text-xl font-bold text-white">{section.title}</h2>{section.text && <p className="mt-4 text-base leading-8 text-slate-300">{section.text}</p>}{section.items && <ul className="mt-4 list-disc space-y-3 pl-5 text-base leading-8 text-slate-300">{section.items.map(item => <li key={item}>{item}</li>)}</ul>}{section.link && <Link href={section.link[1]} className="mt-4 inline-block text-sm font-bold text-cyan-300">{section.link[0]} →</Link>}</section>)}
          <section className="topic-guide-section rounded-xl border border-slate-700 bg-slate-900/65 p-5 sm:p-7"><h2 className="text-xl font-bold text-white">联系与相关说明</h2><a href={`mailto:${email}`} className="mt-4 inline-block break-all text-base text-cyan-300">{email}</a><nav aria-label="支持与服务页面" className="mt-5 flex flex-wrap gap-4 text-sm font-semibold text-cyan-300">{Object.entries(supportPages).filter(([key]) => key !== kind).map(([key, value]) => <Link key={key} href={`/${key}`}>{value.title} →</Link>)}<Link href="/?route=market">返回策略市场 →</Link></nav></section>
        </article>
      </div>
    </main>
  </TopicPageFrame>;
}
