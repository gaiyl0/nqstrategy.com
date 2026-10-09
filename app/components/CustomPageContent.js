import Image from 'next/image';
import { safePageImage, safePageLink } from '@/lib/page-content.mjs';

export default function CustomPageContent({ page, interactive = true }) {
  return <article className="custom-page-content space-y-6">
    <header className={`custom-page-hero rounded-2xl border p-8 ${page.heroImageUrl?'has-cover':''}`}>
      {page.heroImageUrl && safePageImage(page.heroImageUrl) && <div className="custom-page-cover relative mb-6 h-64 overflow-hidden rounded-xl"><Image src={page.heroImageUrl} alt={page.title} fill unoptimized referrerPolicy="no-referrer" sizes="100vw" className="object-cover"/></div>}
      <h1 className="text-3xl font-bold leading-tight">{page.title}</h1>
      {page.description && <p className="mt-4 text-base leading-7">{page.description}</p>}
    </header>
    {page.body && <div className="custom-page-body rounded-xl border p-8 whitespace-pre-wrap break-words text-base leading-8">{page.body}</div>}
    {(page.blocks || []).map(block => <section key={block.id} data-tone={block.tone} className={`custom-page-block custom-page-${block.type} rounded-xl border p-7 ${block.type==='image'?`image-${block.layout}`:''}`}>
      {block.type==='image' && safePageImage(block.imageUrl) && <div className="custom-page-block-image relative min-h-64 overflow-hidden rounded-lg"><Image src={block.imageUrl} alt={block.imageAlt} fill unoptimized referrerPolicy="no-referrer" sizes="(min-width:1024px) 50vw, 100vw" className="object-cover"/></div>}
      <div className="min-w-0"><h2 className="text-xl font-bold leading-7">{block.title}</h2>{block.text && <p className="mt-4 whitespace-pre-wrap break-words text-base leading-8">{block.text}</p>}
      {block.type==='action' && (safePageLink(block.href)&&interactive?<a href={block.href} {...(block.href.startsWith('https:')?{target:'_blank',rel:'noopener noreferrer'}:{})} className="custom-page-action mt-5 inline-flex min-h-11 items-center rounded-lg border px-5 py-3 text-sm font-semibold">{block.label} →</a>:<p className="mt-4 text-sm">{safePageLink(block.href)?`${block.label} → ${block.href}`:'请填写有效的操作链接。'}</p>)}</div>
    </section>)}
  </article>;
}
