

import {notFound} from 'next/navigation';

import {getPublicProductBySlug} from '@/lib/public-product';
import PublicProductDetail from './PublicProductDetail';
import TopicPageFrame from '@/app/components/TopicPageFrame';
import {publicSiteSettings} from '@/lib/topic-pages';
import {shareMetadata} from '@/lib/share-content.mjs';

export const dynamic='force-dynamic';

function description(product){return String(product.description||`${product.title} 是 Nexus Quant 市场中的 MT5 自动交易策略。`).replace(/\s+/g,' ').trim().slice(0,160);}

export async function generateMetadata({params}){
  const {slug}=await params;
  const product=getPublicProductBySlug(slug);
  if(!product)return {title:'策略不存在 | Nexus Quant',robots:{index:false,follow:false}};
  const path=`/market/${product.slug}`;
  return shareMetadata({title:product.title,description:description(product),path,image:`/api/share-image?type=strategy&id=${encodeURIComponent(product.slug)}`});
}

export default async function ProductPage({params}){
  const {slug}=await params;
  const product=getPublicProductBySlug(slug);
  if(!product)notFound();
  const canonical=new URL(`/market/${product.slug}`,process.env.NEXT_PUBLIC_SITE_URL||process.env.APP_ORIGINS?.split(',')[0]||'http://localhost:3000').toString();
  const jsonLd={"@context":"https://schema.org","@type":"SoftwareApplication",name:product.title,description:description(product),applicationCategory:'FinanceApplication',operatingSystem:'MetaTrader 5',url:canonical,author:{"@type":"Person",name:product.author},offers:Number(product.price)===0?{"@type":"Offer",price:0,priceCurrency:'USD',availability:'https://schema.org/InStock'}:undefined,aggregateRating:product.social?.ratingCount?{"@type":"AggregateRating",ratingValue:product.social.ratingAverage,ratingCount:product.social.ratingCount}:undefined};
  return <TopicPageFrame settings={publicSiteSettings()}><main className="min-w-0 flex-1">
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(jsonLd).replace(/</g,'\\u003c')}} />
    <PublicProductDetail product={product}/>
  </main></TopicPageFrame>;
}
