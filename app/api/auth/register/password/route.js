import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { parseJson, passwordResetSchema } from '@/lib/validation';
import { createSecurityContext, enforceRateLimits, hashSecurityValue, RATE_LIMITS, withAudit } from '@/lib/security';
import { consumeVerificationCode } from '@/lib/verification-codes';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const context = createSecurityContext(request);
  const ipLimited = enforceRateLimits(context, 'auth.password_reset', [{ policy: RATE_LIMITS.loginIp }]);
  if (ipLimited) return ipLimited;

  try {
    const parsed = await parseJson(request, passwordResetSchema);
    if (!parsed.success) return withAudit(context, parsed.response, {
      eventType: 'auth.password_reset', outcome: 'failure', reasonCode: 'VALIDATION_ERROR',
    });
    const { email: trimmedEmail, code: trimmedCode, newPassword } = parsed.data;
    const targetId = hashSecurityValue('auth-identity', trimmedEmail);
    const accountLimited = enforceRateLimits(context, 'auth.password_reset', [
      { policy: RATE_LIMITS.loginAccount, identifier: targetId },
    ]);
    if (accountLimited) return accountLimited;

    const user = db.prepare('SELECT id, username FROM users WHERE deleted_at IS NULL AND LOWER(email) = ?').get(trimmedEmail);
    const hashedPwd = await hashPassword(newPassword);
    if (!user) {
      return withAudit(context, NextResponse.json({ success: false, message: '无法完成密码重置，请检查验证码或重新获取' }, { status: 400 }), {
        eventType: 'auth.password_reset', outcome: 'failure', reasonCode: 'ACCOUNT_NOT_FOUND', targetType: 'account', targetId,
      });
    }

    let consumed;
    try {
      consumed = consumeVerificationCode({
        email: trimmedEmail,
        purpose: 'reset',
        code: trimmedCode,
        onConsumed: () => {
          const updated = db.prepare(`
            UPDATE users
            SET password = ?, password_reset_required = 0, session_version = session_version + 1
            WHERE id = ? AND deleted_at IS NULL
          `).run(hashedPwd, user.id);
          if (updated.changes !== 1) {
            const error = new Error('Password reset target changed');
            error.code = 'ACCOUNT_STATE_CONFLICT';
            throw error;
          }
          return updated;
        },
      });
    } catch (error) {
      if (error.code === 'ACCOUNT_STATE_CONFLICT') {
        return withAudit(context, NextResponse.json({ success: false, message: '无法完成密码重置，请检查验证码或重新获取' }, { status: 400 }), {
          eventType: 'auth.password_reset', outcome: 'failure', reasonCode: 'ACCOUNT_STATE_CONFLICT', targetType: 'account', targetId,
        });
      }
      throw error;
    }

    if (!consumed.success) {
      return withAudit(context, NextResponse.json({ success: false, message: '无法完成密码重置，请检查验证码或重新获取' }, { status: 400 }), {
        eventType: 'auth.password_reset', outcome: 'failure', reasonCode: `VERIFICATION_CODE_${consumed.reason?.toUpperCase() || 'STATE_CONFLICT'}`, targetType: 'account', targetId,
      });
    }

    return withAudit(context, NextResponse.json({ success: true, message: '密码重置成功！请使用新密码登录' }), {
      eventType: 'auth.password_reset', outcome: 'success', reasonCode: 'PASSWORD_RESET', userId: user.id, targetType: 'user', targetId: user.id,
    });
  } catch (error) {
    console.error('重置密码异常:', error);
    return withAudit(context, NextResponse.json({ success: false, message: '服务异常，请稍后重试' }, { status: 500 }), {
      eventType: 'auth.password_reset', outcome: 'failure', reasonCode: 'INTERNAL_ERROR',
    });
  }
}
