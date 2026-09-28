import Image from 'next/image';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {Activity,ArrowLeft,CheckCircle2,Heart,ShieldCheck,Star} from 'lucide-react';
import {getPublicProductBySlug} from '@/lib/public-product';
import ProductMetrics from './ProductMetrics';
import ShareButton from './ShareButton';

export const dynamic='force-dynamic';

function description(product){return String(product.description||`${product.title} 是 Nexus Quant 市场中的 MT5 自动交易策略。`).replace(/\s+/g,' ').trim().slice(0,160);}

export async function generateMetadata({params}){
  const {slug}=await params;
  const product=getPublicProductBySlug(slug);
  if(!product)return {title:'策略不存在 | Nexus Quant',robots:{index:false,follow:false}};
  const path=`/market/${product.slug}`;
  return {title:`${product.title} | Nexus Quant`,description:description(product),alternates:{canonical:path},openGraph:{type:'website',title:product.title,description:description(product),url:path,images:product.logo_url?[{url:product.logo_url,alt:product.title}]:[]},twitter:{card:product.logo_url?'summary_large_image':'summary',title:product.title,description:description(product),images:product.logo_url?[product.logo_url]:[]}};
}

export default async function ProductPage({params}){
  const {slug}=await params;
  const product=getPublicProductBySlug(slug);
  if(!product)notFound();
  const canonical=new URL(`/market/${product.slug}`,process.env.NEXT_PUBLIC_SITE_URL||process.env.APP_ORIGINS?.split(',')[0]||'http://localhost:3000').toString();
  const jsonLd={"@context":"https://schema.org","@type":"SoftwareApplication",name:product.title,description:description(product),applicationCategory:'FinanceApplication',operatingSystem:'MetaTrader 5',url:canonical,author:{"@type":"Person",name:product.author},offers:{"@type":"Offer",price:Number(product.price),priceCurrency:'USD',availability:'https://schema.org/InStock'},aggregateRating:product.social?.ratingCount?{"@type":"AggregateRating",ratingValue:product.social.ratingAverage,ratingCount:product.social.ratingCount}:undefined};
  return <main className="min-h-screen bg-zinc-950 text-zinc-300">
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(jsonLd).replace(/</g,'\\u003c')}} />
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4"><Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-zinc-500 hover:text-white"><ArrowLeft className="h-4 w-4" />返回 Nexus Quant</Link><ShareButton title={product.title}/></div>
      <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/50 shadow-2xl">
        <div className="grid gap-8 p-7 md:grid-cols-[180px_1fr] md:p-10">
          <div>{product.logo_url?<Image src={product.logo_url} alt={`${product.title} 策略图标`} width={180} height={180} unoptimized className="aspect-square w-full rounded-3xl border border-zinc-700 bg-zinc-950 object-cover"/>:<div className="flex aspect-square items-center justify-center rounded-3xl border border-zinc-800 bg-zinc-950"><Activity className="h-14 w-14 text-cyan-500/50"/></div>}</div>
          <div><div className="mb-3 flex flex-wrap items-center gap-2"><span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-300">MetaTrader 5</span><span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">{product.verification?.label||product.verification?.level||'unverified'}</span></div><h1 className="text-3xl font-black text-white md:text-5xl">{product.title}</h1><p className="mt-3 text-sm text-zinc-500">开发者 <span className="font-bold text-cyan-400">{product.author}</span> · 发布于 {new Date(product.created_at).toLocaleDateString('zh-CN')}</p><p className="mt-6 whitespace-pre-wrap leading-8 text-zinc-300">{product.description||'开发者尚未提供详细策略说明。'}</p><div className="mt-7 flex flex-wrap items-center gap-5"><span className="text-3xl font-black text-white">{Number(product.price)===0?<span className="text-emerald-400">免费</span>:`$${product.price}`}</span><span className="text-xs text-zinc-500">{product.pairs||'未指定品种'} · {product.ea_type||'未指定类型'}</span></div></div>
        </div>
        <div className="grid grid-cols-2 border-t border-zinc-800 md:grid-cols-4"><div className="p-5"><div className="text-xs text-zinc-500">历史胜率</div><div className="mt-1 font-black text-emerald-400">{product.win_rate}</div></div><div className="border-l border-zinc-800 p-5"><div className="text-xs text-zinc-500">最大回撤</div><div className="mt-1 font-black text-red-400">{product.drawdown}</div></div><div className="border-l border-zinc-800 p-5"><div className="text-xs text-zinc-500">永久授权评分</div><div className="mt-1 font-black text-amber-300"><Star className="mr-1 inline h-4 w-4"/>{product.social?.ratingAverage??'—'} ({product.social?.ratingCount||0})</div></div><div className="border-l border-zinc-800 p-5"><div className="text-xs text-zinc-500">收藏</div><div className="mt-1 font-black text-rose-300"><Heart className="mr-1 inline h-4 w-4"/>{product.social?.favoriteCount||0}</div></div></div>
      </section>
      <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6 md:p-9"><div className="mb-6 flex items-center gap-3"><ShieldCheck className="h-6 w-6 text-cyan-400"/><div><h2 className="text-xl font-black text-white">策略证据与回测指标</h2><p className="mt-1 text-xs text-zinc-500">公开页面只展示已通过审核边界的数据；认证不代表未来收益。</p></div></div><ProductMetrics metrics={product.metrics} evidence={product.evidence||[]} report={product.report} verification={product.verification} versions={product.versions||[]}/></section>
      <section className="mt-8 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 text-sm text-amber-200/80"><div className="flex items-center gap-2 font-bold"><CheckCircle2 className="h-4 w-4"/>风险提示</div><p className="mt-2 leading-7">历史回测、报告核验和用户评分均不能保证未来表现。部署任何 EA 前请在模拟账户验证参数，并设置可承受的资金风险上限。</p></section>
    </div>
  </main>;
}
