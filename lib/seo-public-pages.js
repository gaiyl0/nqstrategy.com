import crypto from 'node:crypto';
import db from './db.js';
import { readBrandWorkspace } from './site-brand-store.js';
import { forumReadable, forumEnabled, catalogEnabled } from './site-brand.mjs';

export function canonicalSite(env = process.env) {
  const url = new URL(env.NEXT_PUBLIC_SITE_URL || env.APP_ORIGINS?.split(',')[0] || 'https://nqstrategy.com');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('SEARCH_SITE_INVALID');
  return url.origin;
}
export const pageFingerprint = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

// Sitemap and submission queue deliberately share the same public-content selection.
export function publicSearchPages(database = db, env = process.env) {
  const base = canonicalSite(env);
  const brand = readBrandWorkspace(database).published;
  const entries = [];
  const add = (pathname, content, priority = 0.5, changeFrequency = 'weekly', createdAt) => {
    const entry = { url: `${base}${pathname}`, fingerprint: pageFingerprint(content), priority, changeFrequency };
    if (createdAt && Number.isFinite(Date.parse(createdAt))) entry.lastModified = new Date(createdAt);
    entries.push(entry);
  };
  add('', brand, 1, 'daily');
  for (const page of brand.pages.filter(page => page.enabled)) add(`/pages/${page.slug}`, page, 0.5, 'monthly');
  if (forumEnabled(brand)) add('/forum', brand.forumMode, 0.9, 'daily');
  if (catalogEnabled(brand)) add('/market', brand.catalogEnabled, 0.9, 'daily');
  for (const pathname of ['/ea-strategies', '/xauusd-gold-ea', '/help', '/risk-disclosure']) add(pathname, pathname);
  if (forumReadable(brand)) {
    const posts = database.prepare("SELECT id,title,content,category,created_at FROM posts WHERE moderation_status='visible' ORDER BY id").all();
    for (const post of posts) add(`/forum/${post.id}`, post, 0.7, 'weekly', post.created_at);
  }
  if (catalogEnabled(brand)) {
    const products = database.prepare("SELECT slug,title,description,points_price,created_at FROM products WHERE status='active' AND moderation_status='visible' AND deleted_at IS NULL AND slug IS NOT NULL ORDER BY id").all();
    for (const product of products) add(`/market/${encodeURIComponent(product.slug)}`, product, 0.8, 'weekly', product.created_at);
  }
  return entries;
}
