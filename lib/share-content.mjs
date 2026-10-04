export function articleSummary(content, limit = 160) {
  return String(content || '').replace(/```[\s\S]*?```/g, '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]*>/g, '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/https?:\/\/\S+/g, '').replace(/^[#>*\-•]+\s*/gm, '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

export function articleHeadings(content) {
  return String(content || '').split('\n').flatMap((line, index) => /^#{1,3}\s/.test(line) ? [{ id: `article-section-${index}`, title: line.replace(/^#{1,3}\s/, '') }] : []);
}

export function shareLinks(url, title) {
  return { x: `https://twitter.com/intent/tweet?${new URLSearchParams({ text: title, url })}`, telegram: `https://t.me/share/url?${new URLSearchParams({ url, text: title })}` };
}

export function siteOrigin() {
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_ORIGINS?.split(',')[0] || 'https://nqstrategy.com').replace(/\/$/, '');
}

export function shareMetadata({ title, description, path, image, article = false, author, date }) {
  return { title, description, alternates: { canonical: path }, openGraph: { type: article ? 'article' : 'website', title, description, url: path, siteName: 'Nexus Quant', locale: 'zh_CN', images: [{ url: image, width: 1200, height: 630, alt: title }], ...(article ? { authors: [author], publishedTime: date } : {}) }, twitter: { card: 'summary_large_image', title, description, images: [image] } };
}
