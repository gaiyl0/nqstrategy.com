import { withApiErrors } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import nodemailer from 'nodemailer';
import { parseJson, sendCodeSchema } from '@/lib/validation';
import { createSecurityContext, enforceRateLimits, hashSecurityValue, RATE_LIMITS, withAudit } from '@/lib/security';
import { issueVerificationCode, revokeIssuedVerificationCode } from '@/lib/verification-codes';

export const dynamic = 'force-dynamic';
const RESET_MIN_RESPONSE_MS = 750;

function resetCodeResponse() {
  return NextResponse.json({
    success: true,
    message: '如果该邮箱绑定了有效账户，重置验证码将发送到该邮箱',
  }, { status: 202 });
}

async function waitForResetResponseFloor(startedAt) {
  const remaining = RESET_MIN_RESPONSE_MS - (Date.now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}

async function POSTHandler(request) {
  const startedAt = Date.now();
  const context = createSecurityContext(request);
  const ipLimited = enforceRateLimits(context, 'auth.verification_code', [{ policy: RATE_LIMITS.verificationIp }]);
  if (ipLimited) return ipLimited;

  try {
    const parsed = await parseJson(request, sendCodeSchema);
    if (!parsed.success) return withAudit(context, parsed.response, {
      eventType: 'auth.verification_code', outcome: 'failure', reasonCode: 'VALIDATION_ERROR',
    });
    const { toEmail: targetEmail, type } = parsed.data;
    const targetId = hashSecurityValue('verification-email', targetEmail);
    const emailLimited = enforceRateLimits(context, 'auth.verification_code', [
      { policy: RATE_LIMITS.verificationEmailShort, identifier: targetId },
      { policy: RATE_LIMITS.verificationEmailDaily, identifier: targetId },
    ]);
    if (emailLimited) return emailLimited;

    let resetUser = null;
    if (type === 'reset') {
      resetUser = db.prepare('SELECT id FROM users WHERE deleted_at IS NULL AND LOWER(email) = ?').get(targetEmail);
      if (!resetUser) {
        await waitForResetResponseFloor(startedAt);
        return withAudit(context, resetCodeResponse(), {
          eventType: 'auth.verification_code', outcome: 'failure', reasonCode: 'ACCOUNT_NOT_FOUND', targetType: 'email', targetId, metadata: { purpose: type },
        });
      }
    }

    // 读取发件网关配置
    const settingsRows = db.prepare('SELECT key, value FROM settings').all();
    const settings = settingsRows.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {});
    
    if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPass) {
      if (type === 'reset') {
        await waitForResetResponseFloor(startedAt);
        return withAudit(context, resetCodeResponse(), {
          eventType: 'auth.verification_code', outcome: 'failure', reasonCode: 'SMTP_NOT_CONFIGURED', userId: resetUser.id,
          targetType: 'email', targetId, metadata: { purpose: type },
        });
      }
      return withAudit(context, NextResponse.json({ success: false, message: '系统提示：管理员尚未在后台配置发件网关' }, { status: 500 }), {
        eventType: 'auth.verification_code', outcome: 'failure', reasonCode: 'SMTP_NOT_CONFIGURED', targetType: 'email', targetId, metadata: { purpose: type },
      });
    }

    const isGmail = settings.smtpHost.includes('gmail');
    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: isGmail ? 465 : 587,
      secure: isGmail,
      auth: {
        user: settings.smtpUser,
        pass: settings.smtpPass,
      },
    });

    // 使用 CSPRNG 生成验证码，数据库只保存与邮箱、用途绑定的 HMAC 摘要。
    const issuedCode = issueVerificationCode(targetEmail, type);

    const isReset = type === 'reset';
    const mailOptions = {
      from: `"${settings.siteName || 'Nexus Quant AI'}" <${settings.smtpUser}>`,
      to: targetEmail,
      subject: `[Nexus Quant] ${isReset ? '安全密码重置口令' : '注册验证码'}: ${issuedCode.code}`,
      html: `
        <div style="font-family: monospace; background-color: #09090b; color: #d4d4d8; padding: 36px; border-radius: 16px; max-width: 480px; margin: auto; border: 1px solid #22d3ee40;">
          <h2 style="color: #22d3ee; margin-top: 0; font-size: 22px;">🛡️ Nexus Quant 安全中心</h2>
          <p style="font-size: 14px; line-height: 1.6;">${isReset ? '您正在请求重置您的登录安全密码。' : '欢迎加入量化网络，您的动态验证码如下：'}</p>
          <div style="background-color: #18181b; border: 1px dashed #22d3ee; padding: 18px; text-align: center; font-size: 32px; font-weight: 900; color: #22d3ee; letter-spacing: 6px; border-radius: 10px; margin: 24px 0;">
            ${issuedCode.code}
          </div>
          <p style="font-size: 12px; color: #71717a;">有效期 5 分钟。若非您本人操作，请立即忽略本邮件。</p>
        </div>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (error) {
      // 只撤销本次发送的记录，避免并发请求误删更新后的验证码。
      revokeIssuedVerificationCode(issuedCode.recordId, issuedCode.digest);
      if (type === 'reset') {
        await waitForResetResponseFloor(startedAt);
        return withAudit(context, resetCodeResponse(), {
          eventType: 'auth.verification_code', outcome: 'failure', reasonCode: 'DELIVERY_FAILED', userId: resetUser.id,
          targetType: 'email', targetId, metadata: { purpose: type },
        });
      }
      throw error;
    }
    if (type === 'reset') {
      await waitForResetResponseFloor(startedAt);
      return withAudit(context, resetCodeResponse(), {
        eventType: 'auth.verification_code', outcome: 'success', reasonCode: 'CODE_SENT', userId: resetUser.id,
        targetType: 'email', targetId, metadata: { purpose: type },
      });
    }
    return withAudit(context, NextResponse.json({ success: true }), {
      eventType: 'auth.verification_code', outcome: 'success', reasonCode: 'CODE_SENT', targetType: 'email', targetId, metadata: { purpose: type },
    });
  } catch (error) {
    return withAudit(context, NextResponse.json({ success: false, message: '邮件通信超时，请检查控制台 SMTP 配置' }, { status: 500 }), {
      eventType: 'auth.verification_code', outcome: 'failure', reasonCode: 'DELIVERY_FAILED',
    });
  }
}

export const POST = withApiErrors(POSTHandler, { route: '/api/send-code' });
