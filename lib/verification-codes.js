import crypto from 'crypto';
import db from './db.js';

export const VERIFICATION_CODE_TTL_MS = 5 * 60 * 1000;
export const VERIFICATION_CODE_MAX_ATTEMPTS = 5;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function assertPurpose(purpose) {
  if (purpose !== 'register' && purpose !== 'reset') {
    throw new Error('Unsupported verification code purpose');
  }
}

function getVerificationSecret() {
  const configured = process.env.VERIFICATION_CODE_SECRET || process.env.JWT_SECRET;
  if (configured && configured.length >= 32) return configured;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('VERIFICATION_CODE_SECRET or JWT_SECRET must contain at least 32 characters in production');
  }

  if (!globalThis.__nexusDevVerificationSecret) {
    globalThis.__nexusDevVerificationSecret = crypto.randomBytes(48).toString('base64url');
    console.warn('VERIFICATION_CODE_SECRET is not configured; using an ephemeral development-only secret.');
  }
  return globalThis.__nexusDevVerificationSecret;
}

if (process.env.NODE_ENV === 'production') {
  getVerificationSecret();
}

function digestCode(email, purpose, code) {
  return crypto.createHmac('sha256', getVerificationSecret())
    .update(`verification-code:v1:${purpose}:${normalizeEmail(email)}:${String(code)}`)
    .digest('hex');
}

function digestMatches(storedDigest, candidateDigest) {
  try {
    const stored = Buffer.from(String(storedDigest), 'hex');
    const candidate = Buffer.from(String(candidateDigest), 'hex');
    return stored.length === 32 && candidate.length === 32 && crypto.timingSafeEqual(stored, candidate);
  } catch {
    return false;
  }
}

export function issueVerificationCode(email, purpose, {
  ttlMs = VERIFICATION_CODE_TTL_MS,
  maxAttempts = VERIFICATION_CODE_MAX_ATTEMPTS,
} = {}) {
  assertPurpose(purpose);
  const normalizedEmail = normalizeEmail(email);
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  const digest = digestCode(normalizedEmail, purpose, code);
  const now = Date.now();
  const row = db.prepare(`
    INSERT INTO verification_codes
      (email, purpose, code_digest, expires_at, attempt_count, max_attempts, consumed_at, created_at)
    VALUES (?, ?, ?, ?, 0, ?, NULL, ?)
    ON CONFLICT(email, purpose) DO UPDATE SET
      code_digest = excluded.code_digest,
      expires_at = excluded.expires_at,
      attempt_count = 0,
      max_attempts = excluded.max_attempts,
      consumed_at = NULL,
      created_at = excluded.created_at
    RETURNING id
  `).get(normalizedEmail, purpose, digest, now + ttlMs, maxAttempts, now);

  return { code, digest, recordId: Number(row.id), expiresAt: now + ttlMs };
}

export function revokeIssuedVerificationCode(recordId, digest) {
  return db.prepare(`
    DELETE FROM verification_codes
    WHERE id = ? AND code_digest = ? AND consumed_at IS NULL
  `).run(recordId, digest).changes === 1;
}

export function consumeVerificationCode({ email, purpose, code, onConsumed = () => null }) {
  assertPurpose(purpose);
  const normalizedEmail = normalizeEmail(email);
  const candidateDigest = digestCode(normalizedEmail, purpose, code);

  const consume = db.transaction(() => {
    const now = Date.now();
    const record = db.prepare(`
      SELECT id, code_digest, expires_at, attempt_count, max_attempts, consumed_at
      FROM verification_codes
      WHERE email = ? AND purpose = ?
    `).get(normalizedEmail, purpose);

    if (!record) return { success: false, reason: 'missing' };
    if (record.consumed_at !== null) return { success: false, reason: 'consumed' };
    if (record.expires_at <= now) return { success: false, reason: 'expired' };
    if (record.attempt_count >= record.max_attempts) return { success: false, reason: 'attempts_exceeded' };

    if (!digestMatches(record.code_digest, candidateDigest)) {
      const nextAttempts = record.attempt_count + 1;
      db.prepare(`
        UPDATE verification_codes
        SET attempt_count = attempt_count + 1
        WHERE id = ? AND consumed_at IS NULL AND expires_at > ? AND attempt_count < max_attempts
      `).run(record.id, now);
      return {
        success: false,
        reason: nextAttempts >= record.max_attempts ? 'attempts_exceeded' : 'invalid',
        attemptsRemaining: Math.max(0, record.max_attempts - nextAttempts),
      };
    }

    const consumed = db.prepare(`
      UPDATE verification_codes
      SET consumed_at = ?
      WHERE id = ? AND code_digest = ? AND consumed_at IS NULL
        AND expires_at > ? AND attempt_count < max_attempts
    `).run(now, record.id, record.code_digest, now);
    if (consumed.changes !== 1) return { success: false, reason: 'state_conflict' };

    return { success: true, value: onConsumed() };
  });

  return consume.immediate();
}
