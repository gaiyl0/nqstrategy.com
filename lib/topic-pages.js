import 'server-only';
import db from './db';
import { readPublicSiteSettings } from './public-site-settings';
import { forumReadable } from './site-brand.mjs';

export function publicSiteSettings() {
  return readPublicSiteSettings();
}

export function topicPageData(kind) {
  const settings = publicSiteSettings();
  const terms = kind === 'gold' ? ['%XAUUSD%', '%黄金%', '%点差%', '%网格%'] : ['%MT5%', '%EA%', '%回测%', '%认证%'];
  const posts = forumReadable(settings.siteBrand) ? db.prepare(`SELECT id,title,category,author,created_at FROM posts WHERE moderation_status='visible' AND (title LIKE ? OR title LIKE ? OR title LIKE ? OR title LIKE ?) ORDER BY is_pinned DESC,created_at DESC,id DESC LIMIT 4`).all(...terms) : [];
  return { settings, posts };
}
