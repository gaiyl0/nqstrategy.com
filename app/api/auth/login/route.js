import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { verifyPasswordOrDummy, hashPassword, createSession, needsPasswordRehash } from '@/lib/auth';
import { loginSchema, parseJson } from '@/lib/validation';
import { createSecurityContext, enforceRateLimits, hashSecurityValue, RATE_LIMITS, withAudit } from '@/lib/security';

export async function POST(request) {
  const context = createSecurityContext(request);
  const ipLimited = enforceRateLimits(context, 'auth.login', [
    { policy: RATE_LIMITS.loginIp },
  ]);
  if (ipLimited) return ipLimited;

  try {
    const parsed = await parseJson(request, loginSchema);
    if (!parsed.success) return withAudit(context, parsed.response, {
      eventType: 'auth.login', outcome: 'failure', reasonCode: 'VALIDATION_ERROR',
    });
    const body = parsed.data;
    const identity = body.account;
    const eventType = 'auth.login';
    const targetId = hashSecurityValue('auth-identity', identity);
    const accountLimited = enforceRateLimits(context, eventType, [
      { policy: RATE_LIMITS.loginAccount, identifier: targetId },
    ]);
    if (accountLimited) return accountLimited;

    const { account: trimmedAccount, password } = body;
    const plainPwd = password.trim();

    const user = db.prepare(`
      SELECT * FROM users 
      WHERE deleted_at IS NULL
        AND (LOWER(TRIM(username)) = LOWER(?) OR LOWER(TRIM(email)) = LOWER(?))
    `).get(trimmedAccount, trimmedAccount);

    if (!user) {
      await verifyPasswordOrDummy(plainPwd, null);
      return withAudit(context, NextResponse.json({ success: false, message: '账号或密码不正确' }, { status: 401 }), {
        eventType, outcome: 'failure', reasonCode: 'ACCOUNT_NOT_FOUND', targetType: 'account', targetId,
      });
    }

    const isMatch = await verifyPasswordOrDummy(plainPwd, user.password);
    if (!isMatch) {
      return withAudit(context, NextResponse.json({ success: false, message: '账号或密码不正确' }, { status: 401 }), {
        eventType, outcome: 'failure', reasonCode: 'INVALID_CREDENTIALS', userId: user.id, targetType: 'user', targetId: user.id,
      });
    }

    if (user.role === 'banned') {
      return withAudit(context, NextResponse.json({ success: false, message: '账号或密码不正确' }, { status: 401 }), {
        eventType, outcome: 'failure', reasonCode: 'ACCOUNT_DISABLED', userId: user.id, targetType: 'user', targetId: user.id,
      });
    }

    if (user.password_reset_required) {
      return withAudit(context, NextResponse.json({
        success: false,
        code: 'PASSWORD_RESET_REQUIRED',
        message: '该账户的遗留密码已作废，请通过邮箱验证码重置密码',
      }, { status: 403 }), {
        eventType, outcome: 'failure', reasonCode: 'PASSWORD_RESET_REQUIRED', userId: user.id, targetType: 'user', targetId: user.id,
      });
    }

    // 将旧 bcrypt / 旧版 scrypt 记录平滑升级到当前格式。
    if (needsPasswordRehash(user.password)) {
      const upgradedHash = await hashPassword(plainPwd);
      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(upgradedHash, user.id);
    }

    const safeUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      balance: user.balance || 0,
      avatar_url: user.avatar_url,
      email_verified: user.email_verified,
      join_date: user.join_date,
      session_version: user.session_version,
    };

    await createSession(safeUser);
    return withAudit(context, NextResponse.json({ success: true, user: safeUser }), {
      eventType, outcome: 'success', reasonCode: 'AUTHENTICATED', userId: user.id, actorRole: user.role, targetType: 'user', targetId: user.id,
    });
  } catch (error) {
    console.error('认证服务异常:', error);
    return withAudit(context, NextResponse.json({ success: false, message: '服务异常，请稍后重试' }, { status: 500 }), {
      eventType: 'auth.login', outcome: 'failure', reasonCode: 'INTERNAL_ERROR',
    });
  }
}
