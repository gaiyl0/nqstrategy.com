import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import {
  createWithdrawalSchema,
  idempotencyKeySchema,
  parseJson,
  reviewWithdrawalSchema,
  validate,
} from '@/lib/validation';
import { createSecurityContext, enforceRateLimits, RATE_LIMITS, withAudit } from '@/lib/security';
import { applyWalletDelta, moneyToMinor } from '@/lib/wallet-ledger.mjs';

export const dynamic = 'force-dynamic';

const MIN_WITHDRAWAL = 100;
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

export async function GET(request) {
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
    console.error('获取提现记录异常:', error);
    return audited(jsonError('服务异常', 500), 'failure', 'INTERNAL_ERROR');
  }
}

export async function POST(request) {
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

  const parsed = await parseJson(request, createWithdrawalSchema);
  if (!parsed.success) return audited(parsed.response, 'failure', 'VALIDATION_ERROR');
  const { address: targetAddress, amount } = parsed.data;
  const hasExplicitAmount = amount !== undefined && amount !== null && amount !== '';
  const requestedAmount = hasExplicitAmount ? amount : null;

  try {
    const createWithdrawal = db.transaction(() => {
      const account = db.prepare('SELECT id, username, balance FROM users WHERE id = ? AND deleted_at IS NULL').get(currentUser.id);
      if (!account) throw new WithdrawalError('账户不存在或已停用', 409);

      const pending = db.prepare("SELECT id FROM withdrawals WHERE user_id = ? AND status = 'pending'").get(account.id);
      if (pending) throw new WithdrawalError('您已有正在审核中的提现申请，请等待上一笔处理完成', 409);

      const balance = Number(account.balance);
      const withdrawAmount = hasExplicitAmount ? requestedAmount : balance;
      if (!Number.isFinite(balance) || !Number.isFinite(withdrawAmount) || withdrawAmount < MIN_WITHDRAWAL) {
        throw new WithdrawalError(`最低提现门槛为 ${MIN_WITHDRAWAL} USD`, 400);
      }

      const result = db.prepare("INSERT INTO withdrawals (username, user_id, amount, crypto_address, status) VALUES (?, ?, ?, ?, 'pending')")
        .run(account.username, account.id, withdrawAmount, targetAddress);
      const withdrawalId = Number(result.lastInsertRowid);
      try {
        applyWalletDelta({
          userId: account.id, transactionType: 'WITHDRAWAL_HOLD',
          businessKey: `withdrawal:${withdrawalId}:hold`, amountMinor: -moneyToMinor(withdrawAmount),
          withdrawalId, actorUserId: account.id, metadata: { source: 'withdrawal_request' },
        });
      } catch (error) {
        if (error.message === 'LEDGER_INSUFFICIENT_BALANCE') throw new WithdrawalError('账户可用余额不足', 400);
        throw error;
      }

      return { id: withdrawalId, amount: withdrawAmount };
    });

    const withdrawal = createWithdrawal.immediate();
    return audited(NextResponse.json({
      success: true,
      message: '提现申请已提交，等待审核打款',
      withdrawal,
    }, { status: 201 }), 'success', 'REQUESTED', withdrawal.id, { amount: withdrawal.amount });
  } catch (error) {
    if (error instanceof WithdrawalError) return audited(jsonError(error.message, error.status), 'failure', 'WITHDRAWAL_REJECTED');
    if (isPendingConstraintError(error)) return audited(jsonError('您已有正在审核中的提现申请，请等待上一笔处理完成', 409), 'failure', 'PENDING_EXISTS');
    console.error('提交提现异常:', error);
    return audited(jsonError('提现申请失败', 500), 'failure', 'INTERNAL_ERROR');
  }
}

export async function PATCH(request) {
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
        try {
          applyWalletDelta({
            userId: record.user_id, transactionType: 'WITHDRAWAL_REFUND',
            businessKey: `withdrawal:${record.id}:refund`, idempotencyKey,
            amountMinor: moneyToMinor(record.amount), withdrawalId: record.id,
            actorUserId: currentUser.id, metadata: { source: 'withdrawal_rejection' },
          });
        } catch (error) {
          if (error.message === 'LEDGER_USER_NOT_FOUND') throw new WithdrawalError('申请人账户不存在，审批已回滚', 409);
          throw error;
        }
      }

      return { replayed: false };
    });

    const result = processWithdrawal.immediate();
    return audited(NextResponse.json({
      success: true,
      replayed: result.replayed,
      message: result.replayed
        ? '审批结果已存在，本次为安全重放'
        : status === 'completed' ? '已标记为打款成功' : '申请已驳回，金额已退回用户余额',
    }), 'success', result.replayed ? 'IDEMPOTENT_REPLAY' : status === 'completed' ? 'COMPLETED' : 'REJECTED_AND_REFUNDED', id, { replayed: result.replayed, decision: status });
  } catch (error) {
    if (error instanceof WithdrawalError) return audited(jsonError(error.message, error.status), 'failure', 'WITHDRAWAL_STATE_CONFLICT', id);
    if (isDecisionKeyConflict(error)) return audited(jsonError('该幂等键已用于其他提现审批', 409), 'failure', 'IDEMPOTENCY_CONFLICT', id);
    console.error('审批提现异常:', error);
    return audited(jsonError('操作失败', 500), 'failure', 'INTERNAL_ERROR', id);
  }
}
