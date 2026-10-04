export default function robots() {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_ORIGINS?.split(',')[0] || 'https://nqstrategy.com').replace(/\/$/, '');
  return {
    rules: [
      { userAgent: '*', allow: ['/', '/api/share-image'], disallow: ['/api/', '/tianwei', '/profile', '/assets'] },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
