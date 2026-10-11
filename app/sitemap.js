import { publicSearchPages } from '@/lib/seo-public-pages';
export const dynamic = 'force-dynamic';
export default function sitemap() {
  return publicSearchPages().map(page => ({ url:page.url, lastModified:page.lastModified, changeFrequency:page.changeFrequency, priority:page.priority }));
}
