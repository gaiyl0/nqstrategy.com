import { publishedSiteBrand } from './site-brand-store.js';
import { forumEnabled, forumReadable,catalogEnabled,tasksEnabled } from './site-brand.mjs';

export function forumAccess() {
  const brand = publishedSiteBrand();
  return { enabled: forumEnabled(brand), readable: forumReadable(brand), mode: brand.forumMode };
}
export function siteFeatureAccess() {
  const brand=publishedSiteBrand();
  return {catalog:catalogEnabled(brand),tasks:tasksEnabled(brand)};
}
