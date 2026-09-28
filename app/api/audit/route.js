import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { auditQuerySchema, validate, validationErrorResponse } from '@/lib/validation';
import { createSecurityContext, enforceRateLimits, RATE_LIMITS, withAudit } from '@/lib/security';
import { getAuditHealth, verifyAuditIntegrity } from '@/lib/audit-integrity.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const currentUser = await getSessionUser();
  const context = createSecurityContext(request, currentUser);
  if (currentUser?.role !== 'admin') {
    return withAudit(context, NextResponse.json({ success: false, message: '仅限管理员查看审计日志' }, { status: currentUser ? 403 : 401 }), {
      eventType: 'audit.read', outcome: 'failure', reasonCode: currentUser ? 'FORBIDDEN' : 'UNAUTHENTICATED',
    });
  }

  const limited = enforceRateLimits(context, 'audit.read', [
    { policy: RATE_LIMITS.auditRead, identifier: `user:${currentUser.id}` },
  ]);
  if (limited) return limited;

  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const parsed = validate(auditQuerySchema, params);
  if (!parsed.success) {
    return withAudit(context, validationErrorResponse(parsed.error), {
      eventType: 'audit.read', outcome: 'failure', reasonCode: 'VALIDATION_ERROR',
    });
  }

  try {
    const integrity = verifyAuditIntegrity({ verifyArchiveFiles: false });
    if (!integrity.valid) {
      return withAudit(context, NextResponse.json({
        success: false,
        code: 'AUDIT_INTEGRITY_FAILURE',
        message: '审计完整性校验失败，请立即检查安全日志',
        integrity,
        health: getAuditHealth(),
      }, { status: 503 }), {
        eventType: 'audit.read', outcome: 'failure', reasonCode: 'INTEGRITY_FAILURE',
      });
    }

    const { eventType, outcome, userId, before, limit } = parsed.data;
    const conditions = [];
    const values = [];
    if (eventType) { conditions.push('event_type = ?'); values.push(eventType); }
    if (outcome) { conditions.push('outcome = ?'); values.push(outcome); }
    if (userId) { conditions.push('user_id = ?'); values.push(userId); }
    if (before) { conditions.push('id < ?'); values.push(before); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const logs = db.prepare(`
      SELECT id, request_id, event_type, outcome, reason_code, user_id, actor_role,
             target_type, target_id, source_hash, user_agent, metadata_json, created_at,
             integrity_version, integrity_key_id, previous_hash, entry_hash
      FROM audit_logs
      ${where}
      ORDER BY id DESC
      LIMIT ?
    `).all(...values, limit).map((row) => ({
      ...row,
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : {},
      metadata_json: undefined,
    }));

    return withAudit(context, NextResponse.json({
      success: true,
      logs,
      nextBefore: logs.at(-1)?.id || null,
      integrity,
      health: getAuditHealth(),
    }), {
      eventType: 'audit.read', outcome: 'success', reasonCode: 'OK', metadata: { resultCount: logs.length },
    });
  } catch (error) {
    console.error('读取审计日志失败:', error);
    return withAudit(context, NextResponse.json({ success: false, message: '读取审计日志失败' }, { status: 500 }), {
      eventType: 'audit.read', outcome: 'failure', reasonCode: 'INTERNAL_ERROR',
    });
  }
}
