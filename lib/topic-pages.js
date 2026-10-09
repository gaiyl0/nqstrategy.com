import 'server-only';
import db from './db';
import { publishedSiteBrand } from './site-brand-store';
import { forumReadable } from './site-brand.mjs';

export function publicSiteSettings() {
  const settings = Object.fromEntries(db.prepare("SELECT key,value FROM settings WHERE key IN ('siteName','contactEmail','socialXUrl','telegramGroupUrl','mt5DownloadEnabled','mt5DownloadUrl','mt5DownloadLabel','mt5DownloadDescription')").all().map(row => [row.key, row.key === 'mt5DownloadEnabled' ? row.value === 'true' : row.value]));
  settings.siteBrand = publishedSiteBrand();
  settings.siteName = settings.siteBrand.name;
  return settings;
}

export function topicPageData(kind) {
  const settings = publicSiteSettings();
  const terms = kind === 'gold' ? ['%XAUUSD%', '%黄金%', '%点差%', '%网格%'] : ['%MT5%', '%EA%', '%回测%', '%认证%'];
  const posts = forumReadable(settings.siteBrand) ? db.prepare(`SELECT id,title,category,author,created_at FROM posts WHERE moderation_status='visible' AND (title LIKE ? OR title LIKE ? OR title LIKE ? OR title LIKE ?) ORDER BY is_pinned DESC,created_at DESC,id DESC LIMIT 4`).all(...terms) : [];
  return { settings, posts };
}
