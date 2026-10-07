import { withApiErrors } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { parseJson } from '@/lib/validation';
import {
  idempotencyKeySchema,
  reviewWithdrawalSchema,
  validate,
} from '@/lib/validation';
import { createSecurityContext, enforceRateLimits, RATE_LIMITS, withAudit } from '@/lib/security';
import { moneyToMinor } from '@/lib/wallet-ledger.mjs';
import { applyPointAssetDelta } from '@/lib/point-assets';

export const dynamic = 'force-dynamic';

class WithdrawalError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'WithdrawalError';
    this.status = status;
  }
}

function jsonError(message, status) {
  return NextResponse.json({ success: false, message }, { status });
}

function isPendingConstraintError(error) {
  const message = String(error?.message || '');
  return error?.code === 'SQLITE_CONSTRAINT_UNIQUE' &&
    (message.includes('idx_withdrawals_one_pending_per_user_id') || message.includes('withdrawals.user_id'));
}

function isDecisionKeyConflict(error) {
  const message = String(error?.message || '');
  return error?.code === 'SQLITE_CONSTRAINT_UNIQUE' &&
    (message.includes('idx_withdrawals_decision_key') || message.includes('withdrawals.decision_key'));
}

function readIdempotencyKey(request) {
  const parsed = validate(idempotencyKeySchema, request.headers.get('idempotency-key'));
  return parsed.success ? parsed.data : null;
}

async function GETHandler(request) {
  const currentUser = await getSessionUser();
  const context = createSecurityContext(request, currentUser);
  const limited = enforceRateLimits(context, 'withdrawal.read', [{
    policy: RATE_LIMITS.withdrawalRead,
    identifier: currentUser ? `user:${currentUser.id}` : context.sourceHash,
  }]);
  if (limited) return limited;
  const audited = (response, outcome, reasonCode, metadata = {}) => withAudit(context, response, {
    eventType: 'withdrawal.read', outcome, reasonCode, metadata,
  });

  try {
    if (!currentUser) return audited(jsonError('未登录', 401), 'failure', 'UNAUTHENTICATED');

    const withdrawals = currentUser.role === 'admin'
      ? db.prepare('SELECT * FROM withdrawals ORDER BY created_at DESC, id DESC').all()
      : db.prepare('SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC, id DESC').all(currentUser.id);

    return audited(NextResponse.json({ success: true, withdrawals }), 'success', 'LISTED', { resultCount: withdrawals.length });
  } catch (error) {
    return audited(jsonError('服务异常', 500), 'failure', 'INTERNAL_ERROR');
  }
}

async function POSTHandler(request) {
  const currentUser = await getSessionUser();
  const context = createSecurityContext(request, currentUser);
  const identifier = currentUser ? `user:${currentUser.id}` : context.sourceHash;
  const limited = enforceRateLimits(context, 'withdrawal.create', [
    { policy: RATE_LIMITS.withdrawalCreateShort, identifier },
    { policy: RATE_LIMITS.withdrawalCreateDaily, identifier },
  ]);
  if (limited) return limited;
  const audited = (response, outcome, reasonCode, targetId = null, metadata = {}) => withAudit(context, response, {
    eventType: 'withdrawal.create', outcome, reasonCode, targetType: targetId ? 'withdrawal' : null, targetId, metadata,
  });
  if (!currentUser) return audited(jsonError('请先登录', 401), 'failure', 'UNAUTHENTICATED');

  // Legacy dollar wallet remains auditable, but new withdrawals use point assets.
  return audited(jsonError('美元钱包已迁入积分资产，请在积分中心申请提现', 410), 'blocked', 'LEGACY_WALLET_CLOSED');


}

async function PATCHHandler(request) {
  const currentUser = await getSessionUser();
  const context = createSecurityContext(request, currentUser);
  const limited = enforceRateLimits(context, 'withdrawal.review', [{
    policy: RATE_LIMITS.withdrawalAdmin,
    identifier: currentUser ? `user:${currentUser.id}` : context.sourceHash,
  }]);
  if (limited) return limited;
  const audited = (response, outcome, reasonCode, targetId = null, metadata = {}) => withAudit(context, response, {
    eventType: 'withdrawal.review', outcome, reasonCode, targetType: targetId ? 'withdrawal' : null, targetId, metadata,
  });
  if (!currentUser) return audited(jsonError('请先登录', 401), 'failure', 'UNAUTHENTICATED');
  if (currentUser.role !== 'admin') return audited(jsonError('仅限管理员操作', 403), 'failure', 'FORBIDDEN');

  const parsed = await parseJson(request, reviewWithdrawalSchema);
  if (!parsed.success) return audited(parsed.response, 'failure', 'VALIDATION_ERROR');
  const { id, status } = parsed.data;
  const idempotencyKey = readIdempotencyKey(request);
  if (!idempotencyKey) return audited(jsonError('缺少或非法的 Idempotency-Key', 400), 'failure', 'INVALID_IDEMPOTENCY_KEY', id);

  try {
    const processWithdrawal = db.transaction(() => {
      const record = db.prepare('SELECT id, user_id, amount, status, decision_key FROM withdrawals WHERE id = ?').get(id);
      if (!record) throw new WithdrawalError('该提现记录不存在', 404);

      if (record.decision_key) {
        if (record.decision_key === idempotencyKey && record.status === status) {
          return { replayed: true };
        }
        throw new WithdrawalError('该申请已由其他审批请求处理', 409);
      }

      const statusUpdate = db.prepare(`
        UPDATE withdrawals
        SET status = ?, decision_key = ?, decision_at = CURRENT_TIMESTAMP, decision_by_user_id = ?
        WHERE id = ? AND status = 'pending' AND decision_key IS NULL
      `).run(status, idempotencyKey, currentUser.id, id);
      if (statusUpdate.changes !== 1) throw new WithdrawalError('该申请已处理，请勿重复操作', 409);

      if (status === 'rejected') {
        const owner=db.prepare('SELECT role FROM users WHERE id=?').get(record.user_id);
        if(!owner)throw new WithdrawalError('申请人账户不存在，审批已回滚',409);
        const units=moneyToMinor(record.amount);
        applyPointAssetDelta(record.user_id,{funded:units,withdrawable:['developer','admin'].includes(owner.role)?units:0},`legacy-withdrawal:${record.id}:refund`,'legacy_withdrawal_refund',{legacyWithdrawalId:record.id},Date.now());
      }

      return { replayed: false };
    });

    const result = processWithdrawal.immediate();
    return audited(NextResponse.json({
      success: true,
      replayed: result.replayed,
      message: result.replayed
        ? '审批结果已存在，本次为安全重放'
        : status === 'completed' ? '已标记为打款成功' : '申请已驳回，金额已退回积分资产',
    }), 'success', result.replayed ? 'IDEMPOTENT_REPLAY' : status === 'completed' ? 'COMPLETED' : 'REJECTED_AND_REFUNDED', id, { replayed: result.replayed, decision: status });
  } catch (error) {
    if (error instanceof WithdrawalError) return audited(jsonError(error.message, error.status), 'failure', 'WITHDRAWAL_STATE_CONFLICT', id);
    if (isDecisionKeyConflict(error)) return audited(jsonError('该幂等键已用于其他提现审批', 409), 'failure', 'IDEMPOTENCY_CONFLICT', id);
    return audited(jsonError('操作失败', 500), 'failure', 'INTERNAL_ERROR', id);
  }
}

export const GET = withApiErrors(GETHandler, { route: '/api/withdraw' });
export const POST = withApiErrors(POSTHandler, { route: '/api/withdraw' });
export const PATCH = withApiErrors(PATCHHandler, { route: '/api/withdraw' });
