import { z } from 'zod';

const text = max => z.string().trim().max(max);
export function safePageImage(value) {
  if (/^\/(?:images|uploads|design)\/[A-Za-z0-9_./-]+\.(?:png|jpe?g|webp)$/i.test(value) && !value.includes('..')) return true;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}
export function safePageLink(value) {
  if (/^\/(?:help|risk-disclosure|privacy|terms|ea-strategies|xauusd-gold-ea)$/.test(value)) return true;
  if (/^\/\?route=(?:home|market|points|profile|forum)$/.test(value)) return true;
  if (/^\/pages\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) return true;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}
const image = text(500).refine(value => safePageImage(value), '图片须为站内 PNG/JPEG/WebP 或 HTTPS 地址');
const common = { id: text(60).regex(/^[a-zA-Z0-9-]+$/), title: text(120).min(1), text: text(4000), tone: z.enum(['neutral','blue','gold']) };
export const pageBlockSchema = z.discriminatedUnion('type', [
  z.object({ ...common, type: z.literal('text') }).strict(),
  z.object({ ...common, type: z.literal('image'), imageUrl: image, imageAlt: text(200).min(1,'请填写图片说明'), layout: z.enum(['left','right','top']) }).strict(),
  z.object({ ...common, type: z.literal('action'), label: text(40).min(1), href: text(500).refine(safePageLink,'请选择系统页面、自定义页面或 HTTPS 链接') }).strict(),
]);
export const pageBlocksSchema = z.array(pageBlockSchema).max(16,'每页最多16个区块').default([]).superRefine((blocks,ctx) => {
  if (new Set(blocks.map(block => block.id)).size !== blocks.length) ctx.addIssue({code:'custom',message:'区块标识不能重复'});
});
export const pageHeroImageSchema = text(500).refine(value => !value || safePageImage(value),'封面须为站内图片或 HTTPS 地址').default('');
export function newPageBlock(type, id) {
  const base = {id,title:type==='action'?'下一步':type==='image'?'图文介绍':'内容标题',text:'',tone:type==='action'?'blue':'neutral',type};
  return type==='image'?{...base,imageUrl:'/images/editorial/article-gold.webp',imageAlt:'黄金与交易研究配图',layout:'left'}:type==='action'?{...base,label:'查看商品',href:'/?route=market'}:base;
}
export function pageTemplate(kind, idPrefix) {
  return kind==='brand' ? [
    {...newPageBlock('image',`${idPrefix}-intro`),title:'关于我们的品牌',text:'介绍品牌的定位、服务对象和主要产品。请填写真实信息。',tone:'blue'},
    {...newPageBlock('text',`${idPrefix}-service`),title:'产品与服务',text:'说明可以提供的产品、服务范围，以及用户如何获得帮助。'},
    {...newPageBlock('action',`${idPrefix}-next`),title:'了解我们的产品'},
  ] : [
    {...newPageBlock('text',`${idPrefix}-intro`),title:'商品介绍',text:'填写商品用途、适用对象和使用条件。'},
    {...newPageBlock('text',`${idPrefix}-conditions`),title:'获取与使用说明',text:'说明获取方式、版本更新和支持范围。请勿将未实现的功能写成已有服务。',tone:'gold'},
    {...newPageBlock('action',`${idPrefix}-next`),title:'查看可获取的商品'},
  ];
}

export function brandImageReferences(workspace) {
  const configs=[workspace?.draft,workspace?.published,...(workspace?.history||[]).map(item=>item.config)];
  return new Set(configs.filter(Boolean).flatMap(config=>[config.logoUrl,config.faviconUrl,...(config.pages||[]).flatMap(page=>[page.heroImageUrl,...(page.blocks||[]).filter(block=>block.type==='image').map(block=>block.imageUrl)])]).filter(value=>typeof value==='string'&&value.startsWith('/uploads/')));
}
