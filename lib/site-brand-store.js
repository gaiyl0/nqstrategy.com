import db from './db.js';
import { defaultSiteBrand, siteBrandSchema } from './site-brand.mjs';
import { defaultHomeConfig } from './home-config.mjs';

const KEY = 'siteBrandWorkspace';
export function readBrandWorkspace(database = db) {
  const raw = database.prepare('SELECT value FROM settings WHERE key=?').get(KEY)?.value;
  const settings = Object.fromEntries(database.prepare("SELECT key,value FROM settings WHERE key IN ('siteName','homeModules','homeHeroTitle','homeHeroDescription','homeArticleCount','featuredRotationSeconds','featuredAutoRotate')").all().map(row => [row.key, row.value]));
  if (raw) {
    const workspace = JSON.parse(raw);
    const normalize = config => ({ ...config, faviconUrl:config.faviconUrl||'', forumMode: config.forumMode || 'enabled', preset:config.preset||'custom',home:{...defaultHomeConfig(settings),...config.home} });
    return { ...workspace, published: normalize(workspace.published), draft: normalize(workspace.draft), history: workspace.history.map(item => ({ ...item, config: normalize(item.config) })) };
  }
  const config = defaultSiteBrand(settings);
  return { revision: 0, published: config, draft: config, history: [], updatedAt: null };
}

export function publishedSiteBrand() { return readBrandWorkspace().published; }

export function updateBrandWorkspace({ action, revision, config }, audit, database = db) {
  return database.transaction(() => {
    const previous = readBrandWorkspace(database);
    if (previous.revision !== revision) throw new Error('BRAND_REVISION_CONFLICT');
    let next = { ...previous, revision: revision + 1, updatedAt: new Date().toISOString() };
    if (action === 'draft') next.draft = siteBrandSchema.parse(config);
    else {
      const target = action === 'restore' ? previous.history[0]?.config : previous.draft;
      if (!target) throw new Error('BRAND_HISTORY_EMPTY');
      const validated = siteBrandSchema.parse(target);
      next = { ...next, published: validated, draft: validated,
        history: [{ config: previous.published, publishedAt: next.updatedAt }, ...previous.history].slice(0, 5) };
    }
    database.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(KEY, JSON.stringify(next));
    if (audit && !audit({ action, revision: next.revision })) throw new Error('BRAND_AUDIT_FAILED');
    return next;
  })();
}
