import db from './db.js';
import {getStrategyMetrics} from './strategy-metrics.js';
import {getCurrentVersion} from './product-versions.js';
import {getVerification} from './strategy-verification.js';
import {siteFeatureAccess} from './forum-feature.js';

export function homeCatalog(){
  if(!siteFeatureAccess().catalog)return {products:[],catalogMinimumPoints:null};
  const raw=db.prepare("SELECT value FROM settings WHERE key='featuredProductIds'").get()?.value;
  let ids=null;try{const parsed=JSON.parse(raw);if(Array.isArray(parsed))ids=parsed.map(Number).filter(Number.isSafeInteger).slice(0,3);}catch{}
  const visible="p.status='active' AND p.moderation_status='visible' AND p.deleted_at IS NULL";
  const candidates=db.prepare(`SELECT p.id,p.slug,p.title,p.author,p.author_user_id,SUBSTR(p.description,1,300) description,p.logo_url,p.price,p.points_price,p.allow_bonus_points,p.pairs,p.ea_type,p.status,p.created_at
    FROM products p WHERE ${visible} ${ids?`AND p.id IN (${ids.length?ids.map(()=>'?').join(','):'NULL'})`:"AND EXISTS(SELECT 1 FROM strategy_reports r WHERE r.product_id=p.id) AND EXISTS(SELECT 1 FROM strategy_metrics m WHERE m.product_id=p.id AND m.reviewed_at IS NOT NULL)"}
    ORDER BY p.created_at DESC LIMIT 3`).all(...(ids||[]));
  const products=(ids?ids.map(id=>candidates.find(p=>p.id===id)).filter(Boolean):candidates).map(product=>{
    const metrics=getStrategyMetrics(product.id),report=db.prepare('SELECT id FROM strategy_reports WHERE product_id=?').get(product.id);
    return {...product,metrics,report:report||null,currentVersion:getCurrentVersion(product.id),verification:getVerification(product.id)};
  });
  const minimum=db.prepare(`SELECT MIN(p.points_price) minimum FROM products p WHERE ${visible} AND p.price>0 AND p.points_price>0
    AND EXISTS(SELECT 1 FROM product_versions v WHERE v.product_id=p.id AND v.status='published' AND v.is_current=1)`).get().minimum;
  const counts=db.prepare(`SELECT COUNT(*) active,COUNT(DISTINCT p.author_user_id) developers FROM products p WHERE ${visible}`).get();
  const verified=db.prepare(`SELECT COUNT(*) n FROM products p WHERE ${visible} AND EXISTS(SELECT 1 FROM strategy_reports r JOIN strategy_metrics m ON m.product_id=r.product_id WHERE r.product_id=p.id AND m.reviewed_at IS NOT NULL)`).get().n;
  return {products,catalogMinimumPoints:minimum??null,catalogCounts:{...counts,verified}};
}
