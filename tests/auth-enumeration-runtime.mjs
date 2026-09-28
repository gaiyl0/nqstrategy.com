import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';

const databasePath = process.env.NEXUS_DB_PATH;
const baseUrl = process.env.TEST_BASE_URL;
const proxySecret = process.env.TRUSTED_PROXY_SHARED_SECRET;
assert.ok(databasePath && baseUrl && proxySecret, 'Runtime test environment is incomplete');

const db = new Database(databasePath);
const password = 'Correct-password-123!';
const salt = 'abcdef0123456789abcdef0123456789';
const passwordHash = `scrypt$${salt}$${crypto.scryptSync(password, salt, 64).toString('hex')}`;
const insert = db.prepare(`
  INSERT INTO users (username, email, password, role, email_verified, password_reset_required)
  VALUES (?, ?, ?, ?, 1, ?)
`);
insert.run('known-user', 'known@example.test', passwordHash, 'user', 0);
insert.run('reset-user', 'reset@example.test', passwordHash, 'user', 1);
insert.run('banned-user', 'banned@example.test', passwordHash, 'banned', 0);

let ipCounter = 10;
async function post(pathname, body) {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://nexus.test',
      'x-forwarded-for': `198.51.100.${ipCounter++}`,
      'x-nexus-proxy-secret': proxySecret,
    },
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    body: await response.json(),
    elapsedMs: performance.now() - startedAt,
    auditStatus: response.headers.get('x-audit-status'),
  };
}

const unknownLogin = await post('/api/auth/login', { account: 'missing@example.test', password: 'wrong-password' });
const wrongLogin = await post('/api/auth/login', { account: 'known@example.test', password: 'wrong-password' });
const bannedLogin = await post('/api/auth/login', { account: 'banned@example.test', password });
assert.deepEqual({ status: unknownLogin.status, body: unknownLogin.body }, { status: wrongLogin.status, body: wrongLogin.body });
assert.deepEqual({ status: bannedLogin.status, body: bannedLogin.body }, { status: wrongLogin.status, body: wrongLogin.body });
assert.equal(unknownLogin.status, 401);

const resetRequiredWrong = await post('/api/auth/login', { account: 'reset@example.test', password: 'wrong-password' });
assert.deepEqual({ status: resetRequiredWrong.status, body: resetRequiredWrong.body }, { status: wrongLogin.status, body: wrongLogin.body });
const resetRequiredCorrect = await post('/api/auth/login', { account: 'reset@example.test', password });
assert.equal(resetRequiredCorrect.status, 403);
assert.equal(resetRequiredCorrect.body.code, 'PASSWORD_RESET_REQUIRED');
const validLogin = await post('/api/auth/login', { account: 'known@example.test', password });
assert.equal(validLogin.status, 200);
assert.equal(validLogin.body.user.email, 'known@example.test');

const unknownCode = await post('/api/send-code', { toEmail: 'missing@example.test', type: 'reset' });
const knownCode = await post('/api/send-code', { toEmail: 'known@example.test', type: 'reset' });
assert.deepEqual({ status: unknownCode.status, body: unknownCode.body }, { status: knownCode.status, body: knownCode.body });
assert.equal(unknownCode.status, 202);
assert.ok(unknownCode.elapsedMs >= 700 && knownCode.elapsedMs >= 700);
assert.ok(Math.abs(unknownCode.elapsedMs - knownCode.elapsedMs) < 250);

const resetBody = { code: '000000', newPassword: 'New-password-123!' };
const unknownReset = await post('/api/auth/register/password', { email: 'missing@example.test', ...resetBody });
const knownReset = await post('/api/auth/register/password', { email: 'known@example.test', ...resetBody });
assert.deepEqual({ status: unknownReset.status, body: unknownReset.body }, { status: knownReset.status, body: knownReset.body });
assert.equal(unknownReset.status, 400);

const { issueVerificationCode } = await import('../lib/verification-codes.js');
const issued = issueVerificationCode('known@example.test', 'reset');
const successfulReset = await post('/api/auth/register/password', {
  email: 'known@example.test', code: issued.code, newPassword: 'New-password-123!',
});
assert.equal(successfulReset.status, 200);
const oldPasswordAfterReset = await post('/api/auth/login', { account: 'known@example.test', password });
assert.equal(oldPasswordAfterReset.status, 401);
const newPasswordAfterReset = await post('/api/auth/login', { account: 'known@example.test', password: 'New-password-123!' });
assert.equal(newPasswordAfterReset.status, 200);

for (const result of [unknownLogin, wrongLogin, bannedLogin, resetRequiredWrong, resetRequiredCorrect, validLogin,
  unknownCode, knownCode, unknownReset, knownReset, successfulReset, oldPasswordAfterReset, newPasswordAfterReset]) {
  assert.equal(result.auditStatus, 'ok');
}

const reasons = db.prepare(`
  SELECT reason_code, COUNT(*) count FROM audit_logs
  WHERE event_type IN ('auth.login', 'auth.password_reset', 'auth.verification_code')
  GROUP BY reason_code
`).all();
const reasonMap = Object.fromEntries(reasons.map((row) => [row.reason_code, row.count]));
assert.ok(reasonMap.ACCOUNT_NOT_FOUND >= 3);
assert.ok(reasonMap.INVALID_CREDENTIALS >= 2);
assert.ok(reasonMap.ACCOUNT_DISABLED >= 1);
assert.ok(reasonMap.PASSWORD_RESET_REQUIRED >= 1);
assert.ok(reasonMap.SMTP_NOT_CONFIGURED >= 1);
assert.ok(reasonMap.VERIFICATION_CODE_MISSING >= 1);

console.log(JSON.stringify({
  passed: true,
  assertions: 36,
  login: {
    publicFailureStatus: unknownLogin.status,
    unknownMs: Math.round(unknownLogin.elapsedMs),
    wrongPasswordMs: Math.round(wrongLogin.elapsedMs),
  },
  resetCode: {
    status: unknownCode.status,
    unknownMs: Math.round(unknownCode.elapsedMs),
    knownMs: Math.round(knownCode.elapsedMs),
  },
  resetSubmissionStatus: unknownReset.status,
  internalAuditReasons: Object.keys(reasonMap).sort(),
}, null, 2));
db.close();
