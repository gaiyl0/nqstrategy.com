import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import db, { withAuditMaintenance } from '../lib/db.js';
import {
  appendAuditRecord,
  archiveExpiredAuditLogs,
  getAuditHealth,
  verifyAuditIntegrity,
} from '../lib/audit-integrity.mjs';
import { validateAuditConfig } from '../lib/audit-config.mjs';

assert.match(path.basename(process.cwd()), /^\.tmp-audit-integrity-/,
  'This destructive test must run from an isolated temporary directory');

function record(name, createdAt) {
  return {
    request_id: crypto.randomUUID(), event_type: `test.${name}`, outcome: 'success',
    reason_code: 'TEST', user_id: null, actor_role: 'system', target_type: 'test',
    target_id: name, source_hash: crypto.createHash('sha256').update(name).digest('hex'),
    user_agent: 'audit-integrity-test', metadata_json: JSON.stringify({ name }),
    created_at: createdAt,
  };
}

const now = Date.now();
const old = now - 40 * 24 * 60 * 60 * 1000;
const first = appendAuditRecord(record('old-1', old));
appendAuditRecord(record('old-2', old + 1));
appendAuditRecord(record('current', now));
assert.equal(verifyAuditIntegrity().valid, true);

assert.throws(() => db.prepare('UPDATE audit_logs SET outcome = ? WHERE id = ?').run('failure', first.id), /append-only/);
assert.throws(() => db.prepare('DELETE FROM audit_logs WHERE id = ?').run(first.id), /append-only/);
assert.throws(() => db.prepare(`
  INSERT INTO audit_logs (request_id, event_type, outcome, reason_code, source_hash, created_at)
  VALUES ('forged', 'test.forged', 'success', 'TEST', 'forged', 1)
`).run(), /append-only/);

const original = db.prepare('SELECT * FROM audit_logs WHERE id = ?').get(first.id);
withAuditMaintenance(() => db.prepare('UPDATE audit_logs SET outcome = ? WHERE id = ?').run('failure', first.id));
assert.match(verifyAuditIntegrity().error, /AUDIT_ENTRY_SIGNATURE_INVALID/);
assert.equal(getAuditHealth().healthy, false);
withAuditMaintenance(() => db.prepare('UPDATE audit_logs SET outcome = ? WHERE id = ?').run(original.outcome, first.id));
assert.equal(verifyAuditIntegrity().valid, true);

withAuditMaintenance(() => db.prepare('DELETE FROM audit_logs WHERE id = ?').run(first.id));
assert.match(verifyAuditIntegrity().error, /AUDIT_CHAIN_BROKEN/);
const columns = Object.keys(original);
withAuditMaintenance(() => db.prepare(
  `INSERT INTO audit_logs (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`,
).run(...columns.map((column) => original[column])));
assert.equal(verifyAuditIntegrity().valid, true);

const archive = archiveExpiredAuditLogs({ now });
assert.equal(archive.archived, true);
assert.equal(archive.rowCount, 2);
assert.equal(verifyAuditIntegrity({ verifyArchiveFiles: true }).valid, true);

const manifestPath = path.resolve(process.cwd(), archive.manifestPath);
const manifestOriginal = fs.readFileSync(manifestPath, 'utf8');
const manifest = JSON.parse(manifestOriginal);
manifest.rowCount += 1;
fs.writeFileSync(manifestPath, JSON.stringify(manifest));
assert.match(verifyAuditIntegrity({ verifyArchiveFiles: true }).error, /AUDIT_ARCHIVE_MANIFEST_INVALID/);
fs.writeFileSync(manifestPath, manifestOriginal);
assert.equal(verifyAuditIntegrity({ verifyArchiveFiles: true }).valid, true);

const contentPath = path.resolve(path.dirname(manifestPath), JSON.parse(manifestOriginal).contentFile);
const contentOriginal = fs.readFileSync(contentPath);
fs.appendFileSync(contentPath, 'forged\n');
assert.match(verifyAuditIntegrity({ verifyArchiveFiles: true }).error, /AUDIT_ARCHIVE_CONTENT_INVALID/);
fs.writeFileSync(contentPath, contentOriginal);
assert.equal(verifyAuditIntegrity({ verifyArchiveFiles: true }).valid, true);

assert.throws(() => validateAuditConfig({ NODE_ENV: 'production' }), /AUDIT_INTEGRITY_SECRET/);
assert.throws(() => validateAuditConfig({
  NODE_ENV: 'production', AUDIT_INTEGRITY_SECRET: 'x'.repeat(32), AUDIT_RETENTION_DAYS: '29',
}), /AUDIT_RETENTION_DAYS/);
assert.equal(validateAuditConfig({
  NODE_ENV: 'production', AUDIT_INTEGRITY_SECRET: 'x'.repeat(32), AUDIT_RETENTION_DAYS: '365',
}).retentionDays, 365);

console.log(JSON.stringify({
  passed: true,
  checks: [
    'valid chain', 'ordinary mutation blocked', 'ordinary deletion blocked',
    'ordinary insertion blocked', 'tamper detected', 'deletion detected',
    'archive verified', 'manifest tamper detected', 'content tamper detected',
    'invalid production configuration rejected', 'health recovers after successful verification',
  ],
}, null, 2));
