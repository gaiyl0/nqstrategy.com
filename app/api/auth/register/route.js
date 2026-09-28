import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { hashPassword, createSession } from '@/lib/auth';
import { parseJson, registerSchema } from '@/lib/validation';
import { createSecurityContext, enforceRateLimits, hashSecurityValue, RATE_LIMITS, withAudit } from '@/lib/security';
import { consumeVerificationCode } from '@/lib/verification-codes';

export async function POST(request) {
  const context = createSecurityContext(request);
  const ipLimited = enforceRateLimits(context, 'auth.register', [{ policy: RATE_LIMITS.registerIp }]);
  if (ipLimited) return ipLimited;

  try {
    const parsed = await parseJson(request, registerSchema);
    if (!parsed.success) return withAudit(context, parsed.response, {
      eventType: 'auth.register', outcome: 'failure', reasonCode: 'VALIDATION_ERROR',
    });
    const { username: trimmedUsername, email: trimmedEmail, password, code } = parsed.data;
    const targetId = hashSecurityValue('registration-email', trimmedEmail);
    const identityLimited = enforceRateLimits(context, 'auth.register', [
      { policy: RATE_LIMITS.registerIdentity, identifier: targetId },
    ]);
    if (identityLimited) return identityLimited;

    // 1. 查重校验。事务内还会再次检查，防止并发注册绕过。
    const existing = db.prepare(
      'SELECT id FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)'
    ).get(trimmedUsername, trimmedEmail);

    if (existing) {
      return withAudit(context, NextResponse.json({ success: false, message: '该用户名或邮箱已被注册' }, { status: 400 }), {
        eventType: 'auth.register', outcome: 'failure', reasonCode: 'IDENTITY_CONFLICT', targetType: 'email', targetId,
      });
    }

    // 2. 密码高强度加盐 Hash
    const hashedPassword = await hashPassword(password);

    // 3. 在同一个立即事务中消费验证码并创建用户；任一写入失败都会整体回滚。
    let consumed;
    try {
      consumed = consumeVerificationCode({
        email: trimmedEmail,
        purpose: 'register',
        code,
        onConsumed: () => {
          const conflict = db.prepare(
            'SELECT id FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)'
          ).get(trimmedUsername, trimmedEmail);
          if (conflict) {
            const error = new Error('Registration identity conflict');
            error.code = 'IDENTITY_CONFLICT';
            throw error;
          }
          return db.prepare(`
            INSERT INTO users (username, email, password, role, email_verified)
            VALUES (?, ?, ?, 'user', 1)
          `).run(trimmedUsername, trimmedEmail, hashedPassword);
        },
      });
    } catch (error) {
      if (error.code === 'IDENTITY_CONFLICT' || error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return withAudit(context, NextResponse.json({ success: false, message: '该用户名或邮箱已被注册' }, { status: 400 }), {
          eventType: 'auth.register', outcome: 'failure', reasonCode: 'IDENTITY_CONFLICT', targetType: 'email', targetId,
        });
      }
      throw error;
    }

    if (!consumed.success) {
      return withAudit(context, NextResponse.json({ success: false, message: '验证码无效或已过期，请重新获取' }, { status: 400 }), {
        eventType: 'auth.register', outcome: 'failure', reasonCode: `VERIFICATION_CODE_${consumed.reason.toUpperCase()}`, targetType: 'email', targetId,
      });
    }

    const result = consumed.value;

    const newUser = {
      id: result.lastInsertRowid,
      username: trimmedUsername,
      email: trimmedEmail,
      role: 'user',
      balance: 0,
      session_version: 1,
    };

    // 4. 签发服务器 HttpOnly Session Cookie
    await createSession(newUser);

    return withAudit(context, NextResponse.json({
      success: true, 
      user: newUser 
    }), {
      eventType: 'auth.register', outcome: 'success', reasonCode: 'REGISTERED', userId: Number(result.lastInsertRowid), actorRole: 'user', targetType: 'user', targetId: result.lastInsertRowid,
    });
  } catch (error) {
    console.error('注册异常:', error);
    return withAudit(context, NextResponse.json({ success: false, message: '服务器开小差了，请稍后重试' }, { status: 500 }), {
      eventType: 'auth.register', outcome: 'failure', reasonCode: 'INTERNAL_ERROR',
    });
  }
}
