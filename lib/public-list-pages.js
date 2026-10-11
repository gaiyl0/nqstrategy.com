import db from './db.js';
import {readPublicSiteSettings} from './public-site-settings.js';
import {homeCatalog} from './home-catalog.js';
import {listForumPosts} from './forum-catalog.js';
import {getPublicProductBySlug} from './public-product.js';
import {queryMarketCatalog} from './market-catalog.mjs';
import {forumEnabled,catalogEnabled} from './site-brand.mjs';
import {homeDisplaySettings} from './home-config.mjs';
import {forumListQuerySchema,forumSortSchema,categorySchema,marketQuerySchema} from './validation.js';

const value=(params,key,fallback='')=>typeof params[key]==='string'?params[key]:fallback;
export function publicForumQuery(params={}){
  const parsed=forumListQuerySchema.safeParse({page:value(params,'forumPage',value(params,'page','1')),pageSize:12,q:value(params,'forumQ',value(params,'q'))});
  const category=categorySchema.safeParse(value(params,'category','全部'));
  const sort=forumSortSchema.safeParse(value(params,'sort','latest'));
  return {category:category.success?category.data:'全部',sort:sort.success?sort.data:'latest',...(parsed.success?parsed.data:{page:1,pageSize:12,q:''})};
}
export function publicMarketQuery(params={}){
  const input={market:'1',pageSize:12,...Object.fromEntries(['q','pair','type','verification','maxDrawdown','maxPrice','page'].filter(key=>typeof params[key]==='string').map(key=>[key,params[key]]))};
  const parsed=marketQuerySchema.safeParse(input);
  return parsed.success?parsed.data:marketQuerySchema.parse({market:'1',pageSize:12});
}
export function publicMarketCatalog(query){
  const candidates=db.prepare(`SELECT p.id,p.slug,p.title,p.author,p.author_user_id,p.description,p.points_price,p.price,p.pairs,p.ea_type,p.status,p.created_at,
    m.max_drawdown_percent metric_drawdown,m.reviewed_at metric_reviewed,
    CASE WHEN v.status='active' AND (v.expires_at IS NULL OR v.expires_at>?) THEN v.level ELSE 'unverified' END verification_level
    FROM products p LEFT JOIN strategy_metrics m ON m.product_id=p.id LEFT JOIN strategy_verifications v ON v.product_id=p.id
    WHERE p.deleted_at IS NULL AND p.status='active' AND p.moderation_status='visible' ORDER BY p.created_at DESC`).all(Date.now())
    .map(product=>({...product,metrics:product.metric_reviewed?{maxDrawdownPercent:product.metric_drawdown,reviewedAt:product.metric_reviewed}:null,verification:{level:product.verification_level}}));
  const result=queryMarketCatalog(candidates,query);
  return {products:result.items.map(product=>getPublicProductBySlug(product.slug)).filter(Boolean),pagination:result.pagination};
}
export function initialAppData(route,params={}){
  const settings=readPublicSiteSettings(),data={settings};
  if(['home','forum'].includes(route)){
    const catalog=homeCatalog();Object.assign(settings,{catalogMinimumPoints:catalog.catalogMinimumPoints,catalogCounts:catalog.catalogCounts});data.homeProducts=catalog.products;
  }
  if(route==='home'&&forumEnabled(settings.siteBrand)){
    const home=homeDisplaySettings(settings).home;
    if(home.modules.some(key=>['articles','discussions'].includes(key)))data.homeForum=listForumPosts({page:1,pageSize:Math.min(20,home.articleCount+6),category:'全部',sort:'latest'});
  }
  if(route==='forum'&&forumEnabled(settings.siteBrand)){data.forumQuery=publicForumQuery(params);data.forum=listForumPosts(data.forumQuery);}
  if(route==='market'&&catalogEnabled(settings.siteBrand)){data.marketQuery=publicMarketQuery(params);data.market=publicMarketCatalog(data.marketQuery);data.products=data.market.products;}
  return data;
}
export function listMetadata(kind,params={},brand){
  const query=kind==='forum'?publicForumQuery(params):publicMarketQuery(params);
  const page=(kind==='forum'?listForumPosts(query):publicMarketCatalog(query)).pagination.page,category=kind==='forum'&&query.category!=='全部'?query.category:'';
  const title=kind==='forum'?`${category||'EA 与 MT5 交流论坛'}${page>1?` · 第 ${page} 页`:''}`:`${query.pair?query.pair+' ':''}EA 策略下载${page>1?` · 第 ${page} 页`:''}`;
  const canonical=new URLSearchParams();
  if(category)canonical.set('category',category);
  if(page>1)canonical.set(kind==='forum'?'forumPage':'page',String(page));
  if(kind==='market')for(const key of ['pair','type','verification','maxDrawdown','maxPrice'])if(query[key]!=null&&query[key]!=='')canonical.set(key,String(query[key]));
  const path=`/${kind}${canonical.size?'?'+canonical:''}`;
  const description=kind==='forum'?`${brand.name} 论坛：交流 MT5 EA 使用、黄金 XAUUSD 策略、MQL5 开发、回测报告与运行问题。`:`${brand.name} EA 策略市场：按交易品种、策略类型、验证资料与积分价格选择 EA，查看版本、风险与下载授权。`;
  const index=!(query.q||kind==='forum'&&query.sort!=='latest');
  return {title,description,alternates:{canonical:path},robots:{index,follow:true},openGraph:{title:`${title} | ${brand.name}`,description,url:path,type:'website'},twitter:{card:'summary_large_image',title,description}};
}
