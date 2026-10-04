import db from './db.js';
import {getStrategyMetrics} from './strategy-metrics.js';
import {listEvidence} from './strategy-evidence.js';
import {getVerification} from './strategy-verification.js';
import {getCurrentVersion,listVersions} from './product-versions.js';
import {productSocialSummary} from './social.js';
import {decodeProductSlug} from './product-slug.mjs';

export function getPublicProductBySlug(slug,viewerUserId=null){
  slug=decodeProductSlug(slug);
  if(!slug)return null;
  const product=db.prepare(`SELECT id,slug,title,author,author_user_id,description,logo_url,price,win_rate,drawdown,pairs,ea_type,trial_enabled,trial_days,status,created_at
    FROM products WHERE slug=? AND deleted_at IS NULL AND status='active' AND moderation_status='visible'`).get(slug);
  if(!product)return null;
  const report=db.prepare('SELECT id,content_sha256,parser_version FROM strategy_reports WHERE product_id=?').get(product.id);
  return {...product,metrics:getStrategyMetrics(product.id),evidence:listEvidence(product.id),report:report?{id:report.id,sha256:report.content_sha256,parserVersion:report.parser_version}:null,verification:getVerification(product.id),currentVersion:getCurrentVersion(product.id),versions:listVersions(product.id),social:productSocialSummary(product.id,viewerUserId)};
}
