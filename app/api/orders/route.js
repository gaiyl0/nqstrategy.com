import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import {
  adminScopeSchema,
  createOrderSchema,
  idempotencyKeySchema,
  parseJson,
  reviewOrderSchema,
  validate,
  validationErrorResponse,
} from '@/lib/validation';
import { createSecurityContext, enforceRateLimits, RATE_LIMITS, withAudit } from '@/lib/security';
import { getCurrentVersion,listEligibleVersions } from '@/lib/product-versions';
import { ensureOrderLicense } from '@/lib/licensing';

export const dynamic = 'force-dynamic';

// 在接入可验证的链上支付提供商、金额/网络/确认数校验和签名回调前保持关闭。
const PAID_CHECKOUT_ENABLED = false;

class OrderError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'OrderError';
    this.status = status;
  }
}

function jsonError(message, status) {
  return NextResponse.json({ success: false, message }, { status });
}

function isOrderConflict(error) {
  return error?.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
    String(error?.message || '').includes('idx_orders_');
}

function isDecisionKeyConflict(error) {
  const message = String(error?.message || '');
  return error?.code === 'SQLITE_CONSTRAINT_UNIQUE' &&
    (message.includes('idx_orders_decision_key') || message.includes('orders.decision_key'));
}

function readIdempotencyKey(request) {
  const parsed = validate(idempotencyKeySchema, request.headers.get('idempotency-key'));
  return parsed.success ? parsed.data : null;
}

export async function GET(request) {
  const currentUser = await getSessionUser();
  const context = createSecurityContext(request, currentUser);
  const limited = enforceRateLimits(context, 'order.read', [{
    policy: RATE_LIMITS.orderRead,
    identifier: currentUser ? `user:${currentUser.id}` : context.sourceHash,
  }]);
  if (limited) return limited;
  const audited = (response, outcome, reasonCode, metadata = {}) => withAudit(context, response, {
    eventType: 'order.read', outcome, reasonCode, metadata,
  });

  try {
    const roleParam = new URL(request.url).searchParams.get('role');

    if (roleParam !== null) {
      const parsedRole = validate(adminScopeSchema, roleParam);
      if (!parsedRole.success) return audited(validationErrorResponse(parsedRole.error), 'failure', 'VALIDATION_ERROR');
      if (currentUser?.role !== 'admin') return audited(jsonError('无权查看全网订单', 403), 'failure', 'FORBIDDEN');

      const orders = db.prepare(`
        SELECT
          o.id AS order_id,
          o.username AS buyer,
          o.buyer_user_id,
          o.created_at AS purchase_date,
          o.price,
          o.status,
          o.tx_hash,
          o.payment_verified,
          o.verified_at,
          o.settled_at,
          o.decision_key,
          o.decision_at,
          o.decision_by_user_id,
          p.id AS product_id,
          p.title,
          p.author,
          p.author_user_id,
          p.logo_url,
          p.file_url
        FROM orders o
        LEFT JOIN products p ON o.product_id = p.id
        ORDER BY o.created_at DESC, o.id DESC
      `).all();

      return audited(NextResponse.json({ success: true, paidCheckoutEnabled: PAID_CHECKOUT_ENABLED, orders }), 'success', 'ADMIN_LISTED', { resultCount: orders.length });
    }

    if (!currentUser) {
      return audited(NextResponse.json({ success: true, paidCheckoutEnabled: PAID_CHECKOUT_ENABLED, orders: [] }), 'success', 'ANONYMOUS_EMPTY');
    }

    // 用户资产库只返回确实拥有下载权益的订单。
    const myOrders = db.prepare(`
      SELECT
        o.id AS order_id,
        o.username AS buyer,
        o.buyer_user_id,
        o.created_at AS purchase_date,
        o.price,
        o.status,
        o.payment_verified,
        p.id AS product_id,
        p.title,
        p.author,
        p.author_user_id,
        p.logo_url,
        p.file_url
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE o.buyer_user_id = ?
        AND o.status = 'completed'
        AND (o.price = 0 OR o.payment_verified = 1)
      ORDER BY o.created_at DESC, o.id DESC
    `).all(currentUser.id).map(order=>{
      const privateVersion=getCurrentVersion(order.product_id,{includePrivate:true});
      const currentVersion=getCurrentVersion(order.product_id);
      const cutoff=privateVersion?.upgradePolicy==='new_purchases_only'?privateVersion.entitlementCutoff:null;
      const purchaseMs=new Date(order.purchase_date).getTime();
      const eligibleVersions=listEligibleVersions(order.product_id,order.purchase_date);
      return {...order,currentVersion,eligibleVersions,latestEligibleVersion:eligibleVersions[0]||null,canDownloadCurrent:Boolean(currentVersion&&(!cutoff||purchaseMs>=cutoff))};
    });

    return audited(NextResponse.json({ success: true, paidCheckoutEnabled: PAID_CHECKOUT_ENABLED, orders: myOrders }), 'success', 'ASSETS_LISTED', { resultCount: myOrders.length });
  } catch (error) {
    console.error('查询订单异常:', error);
    return audited(jsonError('服务异常', 500), 'failure', 'INTERNAL_ERROR');
  }
}

export async function POST(request) {
  const currentUser = await getSessionUser();
  const context = createSecurityContext(request, currentUser);
  const identifier = currentUser ? `user:${currentUser.id}` : context.sourceHash;
  const limited = enforceRateLimits(context, 'order.create', [
    { policy: RATE_LIMITS.orderCreateShort, identifier },
    { policy: RATE_LIMITS.orderCreateDaily, identifier },
  ]);
  if (limited) return limited;
  const audited = (response, outcome, reasonCode, targetId = null, metadata = {}) => withAudit(context, response, {
    eventType: 'order.create', outcome, reasonCode, targetType: targetId ? 'product' : null, targetId, metadata,
  });
  if (!currentUser) return audited(jsonError('请先登录您的量化账户', 401), 'failure', 'UNAUTHENTICATED');

  const parsed = await parseJson(request, createOrderSchema);
  if (!parsed.success) return audited(parsed.response, 'failure', 'VALIDATION_ERROR');
  const { productId } = parsed.data;

  try {
    const product = db.prepare('SELECT id, author, author_user_id, price, status FROM products WHERE id = ?').get(productId);
    if (!product || product.status !== 'active') return audited(jsonError('该策略已下架或不存在', 404), 'failure', 'PRODUCT_UNAVAILABLE', productId);
    if (product.author_user_id === currentUser.id) return audited(jsonError('您不能获取自己发布的策略', 400), 'failure', 'SELF_PURCHASE', productId);

    const price = Number(product.price);
    if (!Number.isFinite(price) || price < 0) return audited(jsonError('产品价格配置无效', 409), 'failure', 'INVALID_PRODUCT_PRICE', productId);

    // 不接收或保存任何客户端 TXID。没有可信支付核验能力时，付费订单不能创建。
    if (price > 0) {
      return audited(jsonError('付费购买暂未开放，请勿转账；平台接入可验证支付后再开放', 503), 'blocked', 'PAID_CHECKOUT_DISABLED', productId);
    }

    const createFreeLicense = db.transaction(() => {
      const existing = db.prepare('SELECT id, status FROM orders WHERE buyer_user_id = ? AND product_id = ?')
        .get(currentUser.id, product.id);
      if (existing) {
        if (existing.status === 'completed') {ensureOrderLicense(existing.id);return { id: existing.id, alreadyOwned: true };}
        throw new OrderError('该策略已有历史订单，请联系管理员处理', 409);
      }

      const result = db.prepare(`
        INSERT INTO orders
          (username, buyer_user_id, product_id, price, status, tx_hash, payment_verified, verified_at, settled_at)
        VALUES (?, ?, ?, 0, 'completed', 'FREE_LICENSE', 1, CURRENT_TIMESTAMP, NULL)
      `).run(currentUser.username, currentUser.id, product.id);

      const id=Number(result.lastInsertRowid);ensureOrderLicense(id);return { id, alreadyOwned: false };
    });

    const license = createFreeLicense.immediate();
    return audited(NextResponse.json({
      success: true,
      alreadyOwned: license.alreadyOwned,
      orderId: license.id,
      message: license.alreadyOwned ? '您已拥有该免费策略' : '免费获取成功，已放入您的资产库',
    }, { status: license.alreadyOwned ? 200 : 201 }), 'success', license.alreadyOwned ? 'ALREADY_OWNED' : 'FREE_LICENSE_CREATED', productId, { orderId: license.id });
  } catch (error) {
    if (error instanceof OrderError) return audited(jsonError(error.message, error.status), 'failure', 'ORDER_CONFLICT', productId);
    if (isOrderConflict(error)) return audited(jsonError('该策略已有订单，请勿重复提交', 409), 'failure', 'ORDER_CONFLICT', productId);
    console.error('创建订单异常:', error);
    return audited(jsonError('订单创建失败', 500), 'failure', 'INTERNAL_ERROR', productId);
  }
}

export async function PATCH(request) {
  const currentUser = await getSessionUser();
  const context = createSecurityContext(request, currentUser);
  const limited = enforceRateLimits(context, 'order.review', [{
    policy: RATE_LIMITS.orderAdmin,
    identifier: currentUser ? `user:${currentUser.id}` : context.sourceHash,
  }]);
  if (limited) return limited;
  const audited = (response, outcome, reasonCode, targetId = null, metadata = {}) => withAudit(context, response, {
    eventType: 'order.review', outcome, reasonCode, targetType: targetId ? 'order' : null, targetId, metadata,
  });
  if (!currentUser) return audited(jsonError('请先登录', 401), 'failure', 'UNAUTHENTICATED');
  if (currentUser.role !== 'admin') return audited(jsonError('仅限管理员操作', 403), 'failure', 'FORBIDDEN');

  const parsed = await parseJson(request, reviewOrderSchema);
  if (!parsed.success) return audited(parsed.response, 'failure', 'VALIDATION_ERROR');
  const { orderId, action } = parsed.data;
  const idempotencyKey = readIdempotencyKey(request);
  if (!idempotencyKey) return audited(jsonError('缺少或非法的 Idempotency-Key', 400), 'failure', 'INVALID_IDEMPOTENCY_KEY', orderId);

  // 人工输入或目视检查 TXID 不能证明链上到账。付费审批和创作者结算保持关闭。
  if (action === 'approve') {
    return audited(jsonError('付费订单审批已关闭：尚未接入可信链上支付核验，不能发放资产或结算', 503), 'blocked', 'PAID_APPROVAL_DISABLED', orderId);
  }

  try {
    const rejectOrder = db.transaction(() => {
      const order = db.prepare('SELECT id, status, decision_key FROM orders WHERE id = ?').get(orderId);
      if (!order) throw new OrderError('找不到对应订单', 404);

      if (order.decision_key) {
        if (order.decision_key === idempotencyKey && order.status === 'rejected') {
          return { replayed: true };
        }
        throw new OrderError('该订单已由其他审批请求处理', 409);
      }

      const update = db.prepare(`
        UPDATE orders
        SET status = 'rejected', decision_key = ?, decision_at = CURRENT_TIMESTAMP, decision_by_user_id = ?
        WHERE id = ? AND status = 'pending' AND decision_key IS NULL
      `).run(idempotencyKey, currentUser.id, orderId);
      if (update.changes !== 1) throw new OrderError('该订单已处理，请勿重复操作', 409);
      return { replayed: false };
    });

    const result = rejectOrder.immediate();
    return audited(NextResponse.json({
      success: true,
      replayed: result.replayed,
      message: result.replayed ? '订单审批结果已存在，本次为安全重放' : '无效订单已驳回',
    }), 'success', result.replayed ? 'IDEMPOTENT_REPLAY' : 'ORDER_REJECTED', orderId, { replayed: result.replayed });
  } catch (error) {
    if (error instanceof OrderError) return audited(jsonError(error.message, error.status), 'failure', 'ORDER_STATE_CONFLICT', orderId);
    if (isDecisionKeyConflict(error)) return audited(jsonError('该幂等键已用于其他订单审批', 409), 'failure', 'IDEMPOTENCY_CONFLICT', orderId);
    console.error('审核订单异常:', error);
    return audited(jsonError('审核操作失败', 500), 'failure', 'INTERNAL_ERROR', orderId);
  }
}
