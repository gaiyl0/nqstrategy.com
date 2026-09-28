import crypto from 'crypto';
import { NextResponse } from 'next/server';
import db from './db';
import { resolveTrustedClientIp } from './deployment-security.mjs';
import { appendAuditRecord, getAuditHealth } from './audit-integrity.mjs';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const RATE_LIMITS = Object.freeze({
  loginIp: { scope: 'auth.login.ip', limit: 30, windowMs: 15 * MINUTE },
  loginAccount: { scope: 'auth.login.account', limit: 8, windowMs: 15 * MINUTE },
  registerIp: { scope: 'auth.register.ip', limit: 10, windowMs: HOUR },
  registerIdentity: { scope: 'auth.register.identity', limit: 3, windowMs: HOUR },
  verificationIp: { scope: 'auth.code.ip', limit: 20, windowMs: HOUR },
  verificationEmailShort: { scope: 'auth.code.email.short', limit: 3, windowMs: 15 * MINUTE },
  verificationEmailDaily: { scope: 'auth.code.email.daily', limit: 6, windowMs: DAY },
  uploadIp: { scope: 'upload.ip', limit: 40, windowMs: 10 * MINUTE },
  uploadUserShort: { scope: 'upload.user.short', limit: 20, windowMs: 10 * MINUTE },
  uploadUserDaily: { scope: 'upload.user.daily', limit: 100, windowMs: DAY },
  versionWrite: { scope:'version.write',limit:30,windowMs:HOUR },
  versionReview: { scope:'version.review',limit:120,windowMs:HOUR },
  licenseWrite:{scope:'license.write',limit:30,windowMs:HOUR},
  licenseVerify:{scope:'license.verify',limit:120,windowMs:MINUTE},
  socialWrite:{scope:'social.write',limit:60,windowMs:HOUR},
  reportWrite:{scope:'report.write',limit:20,windowMs:HOUR},
  reportAdmin:{scope:'report.admin',limit:120,windowMs:HOUR},
  orderRead: { scope: 'order.read', limit: 120, windowMs: MINUTE },
  orderCreateShort: { scope: 'order.create.short', limit: 20, windowMs: 5 * MINUTE },
  orderCreateDaily: { scope: 'order.create.daily', limit: 100, windowMs: DAY },
  orderAdmin: { scope: 'order.admin', limit: 60, windowMs: 10 * MINUTE },
  withdrawalRead: { scope: 'withdrawal.read', limit: 60, windowMs: MINUTE },
  withdrawalCreateShort: { scope: 'withdrawal.create.short', limit: 3, windowMs: HOUR },
  withdrawalCreateDaily: { scope: 'withdrawal.create.daily', limit: 10, windowMs: DAY },
  withdrawalAdmin: { scope: 'withdrawal.admin', limit: 60, windowMs: HOUR },
  auditRead: { scope: 'audit.read', limit: 60, windowMs: MINUTE },
});

function getSecurityHashSecret() {
  const configured = process.env.AUDIT_HASH_SECRET || process.env.JWT_SECRET;
  if (configured && configured.length >= 32) return configured;
  if (!globalThis.__nexusDevAuditSecret) {
    globalThis.__nexusDevAuditSecret = crypto.randomBytes(48).toString('base64url');
  }
  return globalThis.__nexusDevAuditSecret;
}

export function hashSecurityValue(namespace, value) {
  return crypto.createHmac('sha256', getSecurityHashSecret())
    .update(`${namespace}:${String(value ?? '').trim().toLowerCase()}`)
    .digest('hex');
}

export function createSecurityContext(request, user = null) {
  const sourceInfo = resolveTrustedClientIp(request);
  const source = sourceInfo.ip || 'untrusted-proxy-source';
  return {
    requestId: crypto.randomUUID(),
    sourceHash: hashSecurityValue('source', source),
    sourceResolved: Boolean(sourceInfo.ip),
    sourceTrusted: sourceInfo.trusted,
    sourceReason: sourceInfo.reason,
    userId: user?.id ?? null,
    actorRole: user?.role ?? null,
    userAgent: String(request.headers.get('user-agent') || '').slice(0, 300),
  };
}

function sanitizeMetadata(value, depth = 0) {
  if (depth > 3 || value === null || value === undefined) return value ?? null;
  if (typeof value === 'string') return value.slice(0, 300);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeMetadata(item, depth + 1));
  if (typeof value !== 'object') return String(value).slice(0, 300);

  const sanitized = {};
  for (const [key, item] of Object.entries(value).slice(0, 30)) {
    if (/(password|pass|token|secret|code|address|file|content)/i.test(key)) continue;
    sanitized[key] = sanitizeMetadata(item, depth + 1);
  }
  return sanitized;
}

export function writeAudit(context, {
  eventType,
  outcome,
  reasonCode,
  userId = context.userId,
  actorRole = context.actorRole,
  targetType = null,
  targetId = null,
  metadata = {},
}) {
  try {
    appendAuditRecord({
      request_id: context.requestId,
      event_type: eventType,
      outcome,
      reason_code: String(reasonCode || 'UNSPECIFIED').slice(0, 100),
      user_id: userId ?? null,
      actor_role: actorRole || null,
      target_type: targetType || null,
      target_id: targetId === null || targetId === undefined ? null : String(targetId).slice(0, 200),
      source_hash: context.sourceHash,
      user_agent: context.userAgent || null,
      metadata_json: JSON.stringify(sanitizeMetadata({
        ...metadata,
        sourceResolved: context.sourceResolved,
        sourceTrusted: context.sourceTrusted,
        sourceReason: context.sourceReason,
      })).slice(0, 4000),
      created_at: Date.now(),
    });
    return true;
  } catch (error) {
    console.error('写入安全审计日志失败:', error);
    return false;
  }
}

export function withAudit(context, response, event) {
  const written = writeAudit(context, event);
  response.headers.set('X-Request-ID', context.requestId);
  response.headers.set('X-Audit-Status', written ? 'ok' : 'degraded');
  return response;
}

export { getAuditHealth };

function consumeRateLimit(policy, identifier) {
  const now = Date.now();
  const windowStart = Math.floor(now / policy.windowMs) * policy.windowMs;
  const resetAt = windowStart + policy.windowMs;
  const bucketKey = hashSecurityValue('rate-limit', `${policy.scope}:${identifier}:${windowStart}`);

  const row = db.prepare(`
    INSERT INTO rate_limit_buckets (bucket_key, scope, request_count, reset_at, updated_at)
    VALUES (?, ?, 1, ?, ?)
    ON CONFLICT(bucket_key) DO UPDATE SET
      request_count = rate_limit_buckets.request_count + 1,
      updated_at = excluded.updated_at
    RETURNING request_count, reset_at
  `).get(bucketKey, policy.scope, resetAt, now);

  return {
    allowed: row.request_count <= policy.limit,
    limit: policy.limit,
    remaining: Math.max(0, policy.limit - row.request_count),
    retryAfter: Math.max(1, Math.ceil((row.reset_at - now) / 1000)),
    scope: policy.scope,
  };
}

export function enforceRateLimits(context, eventType, layers) {
  for (const layer of layers) {
    const identifier = layer.identifier ?? context.sourceHash;
    const result = consumeRateLimit(layer.policy, identifier);
    if (!result.allowed) {
      const response = NextResponse.json({
        success: false,
        code: 'RATE_LIMITED',
        message: '请求过于频繁，请稍后再试',
        retryAfter: result.retryAfter,
      }, {
        status: 429,
        headers: {
          'Retry-After': String(result.retryAfter),
          'RateLimit-Limit': String(result.limit),
          'RateLimit-Remaining': '0',
          'RateLimit-Reset': String(result.retryAfter),
        },
      });
      return withAudit(context, response, {
        eventType,
        outcome: 'blocked',
        reasonCode: 'RATE_LIMITED',
        metadata: { rateLimitScope: result.scope },
      });
    }
  }
  return null;
}

// 启动时只清理过期限流桶。审计归档和删除必须走受控维护命令。
try {
  const now = Date.now();
  db.prepare('DELETE FROM rate_limit_buckets WHERE reset_at < ?').run(now - DAY);
} catch (error) {
  console.error('清理安全数据失败:', error);
}
