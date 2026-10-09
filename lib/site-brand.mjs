import { z } from 'zod';
import { pageBlocksSchema, pageHeroImageSchema } from './page-content.mjs';
import { defaultHomeConfig, homeConfigSchema } from './home-config.mjs';

export const DEFAULT_NAVIGATION = [
  { label: '首页', labelEn: 'Home', kind: 'route', target: 'home', visible: true },
  { label: 'EA 下载', labelEn: 'EA downloads', kind: 'route', target: 'market', visible: true },
  { label: '论坛', labelEn: 'Forum', kind: 'route', target: 'forum', visible: true },
  { label: '赚积分', labelEn: 'Earn points', kind: 'route', target: 'points', visible: true },
];
export function safeBrandUrl(value) {
  if (/^\/(?:uploads|design|images)\/[A-Za-z0-9_./-]+\.(?:png|jpg|jpeg|webp|svg|ico)$/i.test(value) && !value.includes('..')) return true;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}
export function safeExternalUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}
const text = (max) => z.string().trim().max(max);
const slug = text(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, '页面地址只能使用小写字母、数字和连字符');
export const siteBrandSchema = z.object({
  name: text(100).min(1, '请填写品牌名称'),
  description: text(500),
  logoUrl: text(500).refine(value => !value || safeBrandUrl(value), 'Logo 须为站内图片或 HTTPS 地址'),
  faviconUrl: text(500).refine(value => !value || safeBrandUrl(value), '浏览器图标须为站内图片或 HTTPS 地址').default(''),
  seoTitle: text(160),
  seoDescription: text(500),
  forumMode: z.enum(['enabled','archived','disabled']).default('enabled'),
  catalogEnabled:z.boolean().default(true),
  tasksEnabled:z.boolean().default(true),
  preset: z.enum(['custom','ea','store','brand']).default('custom'),
  home: homeConfigSchema.optional(),
  navigation: z.array(z.object({
    label: text(24).min(1), labelEn: text(40), visible: z.boolean(),
    kind: z.enum(['route', 'page', 'external']), target: text(500).min(1),
  }).strict().superRefine((item, ctx) => {
    const valid = item.kind === 'route' ? ['home','market','forum','points','profile'].includes(item.target)
      : item.kind === 'page' ? slug.safeParse(item.target).success : safeExternalUrl(item.target);
    if (!valid) ctx.addIssue({ code: 'custom', message: '导航目标无效', path: ['target'] });
  })).max(8, '桌面导航最多 8 项'),
  pages: z.array(z.object({
    slug, title: text(120).min(1), description: text(500), body: text(20000), enabled: z.boolean(), heroImageUrl: pageHeroImageSchema, blocks: pageBlocksSchema,
  }).strict()).max(30, '最多 30 个自定义页面'),
}).strict().superRefine((config, ctx) => {
  if (new Set(config.pages.map(page => page.slug)).size !== config.pages.length)
    ctx.addIssue({ code: 'custom', message: '页面地址不能重复', path: ['pages'] });
  for (const [index, page] of config.pages.entries()) {
    for (const [blockIndex, block] of page.blocks.entries()) {
      if (page.enabled && block.type === 'action' && block.href.startsWith('/pages/') && !config.pages.some(target => target.enabled && `/pages/${target.slug}` === block.href))
        ctx.addIssue({ code:'custom',message:'操作引导必须指向已启用的自定义页面',path:['pages',index,'blocks',blockIndex,'href'] });
    }
  }
  for (const [index, item] of config.navigation.entries()) {
    if (item.visible && item.kind === 'page' && !config.pages.some(page => page.slug === item.target && page.enabled))
      ctx.addIssue({ code: 'custom', message: '显示的导航必须指向已启用的页面', path: ['navigation', index, 'target'] });
  }
});

export function defaultSiteBrand(settings = {}) {
  return { name: settings.siteName || 'Nexus Quant', description: '', logoUrl: '', faviconUrl:'', seoTitle: '', seoDescription: '', forumMode: 'enabled', catalogEnabled:true,tasksEnabled:true,preset:'custom', home:defaultHomeConfig(settings), navigation: structuredClone(DEFAULT_NAVIGATION), pages: [] };
}

export function forumEnabled(brand) { return !brand?.forumMode || brand.forumMode === 'enabled'; }
export function forumReadable(brand) { return brand?.forumMode !== 'disabled'; }
export function catalogEnabled(brand) { return brand?.catalogEnabled !== false; }
export function tasksEnabled(brand) { return brand?.tasksEnabled !== false; }

export function navigationHref(item) {
  return item.kind === 'route' ? `/?route=${item.target}` : item.kind === 'page' ? `/pages/${item.target}` : item.target;
}
