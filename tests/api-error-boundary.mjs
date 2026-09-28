import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-api-errors-'));
process.env.NEXUS_DB_PATH = path.join(root, 'test.db');
process.env.JWT_SECRET = crypto.randomBytes(48).toString('base64url');
process.env.AUDIT_INTEGRITY_SECRET = crypto.randomBytes(48).toString('base64url');
process.env.AUDIT_RETENTION_DAYS = '180';

const [{ withApiErrors }, { default: db }, { verifyAuditIntegrity }] = await Promise.all([
  import('../lib/api-errors.js'),
  import('../lib/db.js'),
  import('../lib/audit-integrity.mjs'),
]);

let assertions = 0;
const check = (condition, message) => { assert.ok(condition, message); assertions += 1; };
const request = new Request('http://localhost/api/injected', { method: 'POST', headers: { 'user-agent': 'error-boundary-test' } });
const leaked = "SQLITE_ERROR SELECT * FROM users WHERE password='hunter2' C:\\private\\database.db token=raw-secret";
const failing = withApiErrors(async () => { const error = new Error(leaked); error.code = 'SQLITE_ERROR'; throw error; }, { route: '/api/injected' });
const response = await failing(request, {});
const payload = await response.json();

assert.equal(response.status, 500); assertions += 1;
assert.equal(payload.success, false); assertions += 1;
assert.equal(payload.code, 'INTERNAL_ERROR'); assertions += 1;
assert.equal(payload.message, '服务暂时异常，请稍后重试'); assertions += 1;
check(typeof payload.requestId === 'string' && payload.requestId.length > 20, 'response must contain a request ID');
assert.equal(response.headers.get('x-request-id'), payload.requestId); assertions += 1;
assert.equal(response.headers.get('cache-control'), 'no-store'); assertions += 1;
for (const secret of ['hunter2', 'raw-secret', 'database.db', 'SELECT * FROM users']) {
  check(!JSON.stringify(payload).includes(secret), `response leaked ${secret}`);
}

const audit = db.prepare("SELECT * FROM audit_logs WHERE request_id=? AND event_type='api.internal_error'").get(payload.requestId);
check(Boolean(audit), 'unknown exception must be written to the signed audit log');
assert.equal(audit.reason_code, 'UNHANDLED_EXCEPTION'); assertions += 1;
assert.equal(audit.target_id, '/api/injected'); assertions += 1;
const metadata = JSON.parse(audit.metadata_json);
assert.equal(metadata.exceptionKind, 'SQLITE_ERROR'); assertions += 1;
check(!metadata.diagnostic.includes('hunter2'), 'audit diagnostic must redact password values');
check(!metadata.diagnostic.includes('raw-secret'), 'audit diagnostic must redact token values');
check(!metadata.diagnostic.includes('database.db'), 'audit diagnostic must redact absolute paths');
check(/^[a-f0-9]{64}$/.test(metadata.stackDigest), 'audit diagnostic must include a stack fingerprint');
check(verifyAuditIntegrity().valid, 'error audit record must preserve the signed audit chain');

const successful = withApiErrors(async () => Response.json({ success: true }), { route: '/api/success' });
const successResponse = await successful(new Request('http://localhost/api/success'), {});
assert.equal(successResponse.status, 200); assertions += 1;
check(Boolean(successResponse.headers.get('x-request-id')), 'successful API responses must also receive a request ID');

db.close();
fs.rmSync(root, { recursive: true, force: true });
console.log(`API error boundary tests passed: ${assertions} assertions`);
