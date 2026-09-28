import db from '@/lib/db';

export default function sitemap(){
  const base=(process.env.NEXT_PUBLIC_SITE_URL||process.env.APP_ORIGINS?.split(',')[0]||'http://localhost:3000').replace(/\/$/,'');
  const products=db.prepare("SELECT slug,created_at FROM products WHERE status='active' AND moderation_status='visible' AND slug IS NOT NULL ORDER BY id").all();
  return [{url:base,lastModified:new Date(),changeFrequency:'daily',priority:1},{url:`${base}/?route=market`,lastModified:new Date(),changeFrequency:'daily',priority:0.9},...products.map(product=>({url:`${base}/market/${encodeURIComponent(product.slug)}`,lastModified:new Date(product.created_at),changeFrequency:'weekly',priority:0.8}))];
}
