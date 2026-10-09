import db from '@/lib/db';
import { publishedSiteBrand } from '@/lib/site-brand-store';
import { forumReadable,catalogEnabled } from '@/lib/site-brand.mjs';

export const dynamic = 'force-dynamic';

export default function sitemap() {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_ORIGINS?.split(',')[0] || 'https://nqstrategy.com').replace(/\/$/, '');
  const products = catalogEnabled(publishedSiteBrand())?db.prepare("SELECT slug, created_at FROM products WHERE status='active' AND moderation_status='visible' AND deleted_at IS NULL AND slug IS NOT NULL ORDER BY id").all():[];
  const posts = forumReadable(publishedSiteBrand()) ? db.prepare("SELECT id,created_at FROM posts WHERE moderation_status='visible' ORDER BY id").all() : [];
  return [
    ...publishedSiteBrand().pages.filter(page => page.enabled).map(page => ({ url: `${base}/pages/${page.slug}`, changeFrequency: 'monthly', priority: 0.5 })),
    { url: base, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${base}/ea-strategies`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/xauusd-gold-ea`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/help`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/risk-disclosure`, changeFrequency: 'monthly', priority: 0.3 },
    ...posts.map(post => ({url:`${base}/forum/${post.id}`,lastModified:new Date(post.created_at),changeFrequency:'weekly',priority:0.7})),
    ...products.map(product => ({
      url: `${base}/market/${encodeURIComponent(product.slug)}`,
      lastModified: new Date(product.created_at),
      changeFrequency: 'weekly',
      priority: 0.8,
    })),
  ];
}
