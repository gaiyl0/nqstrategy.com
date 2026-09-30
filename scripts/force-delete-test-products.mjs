import crypto from 'node:crypto';
import db from '../lib/db.js';
import { appendAuditRecord } from '../lib/audit-integrity.mjs';

const [keepTitle, actorIdRaw, execute] = process.argv.slice(2);
const actorId = Number(actorIdRaw);
if (!keepTitle || !Number.isInteger(actorId) || actorId < 1 || execute !== '--execute') {
  throw new Error('用法：node scripts/force-delete-test-products.mjs <保留策略标题> <管理员ID> --execute');
}
const actor = db.prepare("SELECT id,role FROM users WHERE id=? AND role='admin'").get(actorId);
if (!actor) throw new Error('管理员账号不存在或权限不足');
const rows = db.prepare('SELECT id,title FROM products WHERE deleted_at IS NULL AND title<>? ORDER BY id').all(keepTitle);
const now = Date.now();
const result = db.transaction(() => rows.map((product) => {
  const orderCount = Number(db.prepare('SELECT COUNT(*) count FROM orders WHERE product_id=?').get(product.id).count);
  const licenseCount = Number(db.prepare("SELECT COUNT(*) count FROM product_licenses WHERE product_id=? AND status='active'").get(product.id).count);
  db.prepare("UPDATE product_licenses SET status='revoked',revoked_at=?,revoked_by_user_id=?,revocation_reason=?,token_version=token_version+1 WHERE product_id=? AND status='active'").run(now, actor.id, '批量清理测试策略', product.id);
  db.prepare("UPDATE product_versions SET status='retired',is_current=0 WHERE product_id=? AND status IN ('pending','published')").run(product.id);
  db.prepare("UPDATE products SET status='pending',moderation_status='hidden',file_url=NULL,deleted_at=?,deleted_by_user_id=?,deletion_reason=? WHERE id=?").run(now, actor.id, '批量清理测试策略，仅保留指定正式认证策略', product.id);
  return { id:product.id, title:product.title, orderCount, licenseCount };
})).immediate();
appendAuditRecord({ request_id:crypto.randomUUID(), event_type:'product.force_delete.bulk', outcome:'success', reason_code:'ADMIN_BULK_FORCE_DELETE', user_id:actor.id, actor_role:'admin', target_type:'product_collection', target_id:'all_except_kept_product', source_hash:crypto.createHash('sha256').update('server-maintenance').digest('hex'), user_agent:'server-maintenance', metadata_json:JSON.stringify({keepTitle, removed:result.map(({id,title,orderCount,licenseCount})=>({id,title,orderCount,licenseCount}))}), created_at:Date.now() });
console.log(JSON.stringify({success:true,keepTitle,removed:result},null,2));
