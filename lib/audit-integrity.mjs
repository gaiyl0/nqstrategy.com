import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import db, { withAuditMaintenance } from './db.js';
import { validateAuditConfig } from './audit-config.mjs';

const GENESIS_HASH = '0'.repeat(64);
const INTEGRITY_VERSION = 1;
const DEV_KEY_PATH = path.resolve(process.cwd(), 'storage/secrets/audit-integrity.key');

const auditHealth = {
  healthy: true,
  initializedAt: null,
  lastSuccessAt: null,
  lastFailureAt: null,
  consecutiveFailures: 0,
  lastError: null,
};

function developmentSecret() {
  try {
    const existing = fs.readFileSync(DEV_KEY_PATH, 'utf8').trim();
    if (existing.length >= 32) return existing;
  } catch {}

  fs.mkdirSync(path.dirname(DEV_KEY_PATH), { recursive: true });
  const generated = crypto.randomBytes(48).toString('base64url');
  try {
    fs.writeFileSync(DEV_KEY_PATH, `${generated}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    return generated;
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const existing = fs.readFileSync(DEV_KEY_PATH, 'utf8').trim();
    if (existing.length < 32) throw new Error('Development audit integrity key is invalid');
    return existing;
  }
}

function loadKeyRing() {
  const config = validateAuditConfig(process.env);
  const currentSecret = config.integritySecret || developmentSecret();
  const allSecrets = [currentSecret, ...config.previousSecrets];
  const keys = new Map(allSecrets.map((secret) => [keyId(secret), secret]));
  return { config, currentSecret, currentKeyId: keyId(currentSecret), keys };
}

function keyId(secret) {
  return crypto.createHash('sha256').update(secret).digest('hex').slice(0, 16);
}

function hmac(secret, namespace, payload) {
  return crypto.createHmac('sha256', secret).update(`${namespace}:v1:${payload}`).digest('hex');
}

function canonicalLog(row) {
  return JSON.stringify([
    Number(row.integrity_version), row.integrity_key_id, row.previous_hash,
    row.request_id, row.event_type, row.outcome, row.reason_code,
    row.user_id ?? null, row.actor_role ?? null, row.target_type ?? null,
    row.target_id ?? null, row.source_hash, row.user_agent ?? null,
    row.metadata_json ?? null, Number(row.created_at),
  ]);
}

function canonicalState(state) {
  return JSON.stringify([
    state.last_log_id ?? null,
    state.last_entry_hash,
    state.integrity_key_id,
    Number(state.updated_at),
  ]);
}

function canonicalArchive(batch) {
  return JSON.stringify([
    Number(batch.first_log_id), Number(batch.through_log_id), Number(batch.row_count),
    batch.first_previous_hash, batch.last_entry_hash, batch.content_sha256,
    batch.manifest_path, batch.integrity_key_id, Number(batch.created_at),
  ]);
}

function secureEqual(left, right) {
  try {
    const a = Buffer.from(String(left), 'hex');
    const b = Buffer.from(String(right), 'hex');
    return a.length === 32 && b.length === 32 && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function signLog(row, secret) {
  return hmac(secret, 'audit-entry', canonicalLog(row));
}

function signState(state, secret) {
  return hmac(secret, 'audit-state', canonicalState(state));
}

function signArchive(batch, secret) {
  return hmac(secret, 'audit-archive', canonicalArchive(batch));
}

function markSuccess() {
  auditHealth.healthy = true;
  auditHealth.lastSuccessAt = Date.now();
  auditHealth.consecutiveFailures = 0;
  auditHealth.lastError = null;
}

export function recordAuditFailure(error) {
  auditHealth.healthy = false;
  auditHealth.lastFailureAt = Date.now();
  auditHealth.consecutiveFailures += 1;
  auditHealth.lastError = String(error?.message || error || 'Unknown audit failure').slice(0, 500);
}

export function getAuditHealth() {
  return { ...auditHealth };
}

function verifySignedState(state, keys) {
  if (!state) return { valid: false, error: 'AUDIT_STATE_MISSING' };
  const secret = keys.get(state.integrity_key_id);
  if (!secret) return { valid: false, error: 'AUDIT_STATE_KEY_UNKNOWN' };
  if (!secureEqual(state.state_hmac, signState(state, secret))) {
    return { valid: false, error: 'AUDIT_STATE_SIGNATURE_INVALID' };
  }
  return { valid: true };
}

function createState(lastLogId, lastEntryHash, ring, now = Date.now()) {
  const state = {
    last_log_id: lastLogId ?? null,
    last_entry_hash: lastEntryHash,
    integrity_key_id: ring.currentKeyId,
    updated_at: now,
  };
  return { ...state, state_hmac: signState(state, ring.currentSecret) };
}

function installProtectionTriggers() {
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS audit_logs_block_insert
    BEFORE INSERT ON audit_logs WHEN audit_maintenance_allowed() = 0
    BEGIN SELECT RAISE(ABORT, 'audit_logs are append-only'); END;
    CREATE TRIGGER IF NOT EXISTS audit_logs_block_update
    BEFORE UPDATE ON audit_logs WHEN audit_maintenance_allowed() = 0
    BEGIN SELECT RAISE(ABORT, 'audit_logs are append-only'); END;
    CREATE TRIGGER IF NOT EXISTS audit_logs_block_delete
    BEFORE DELETE ON audit_logs WHEN audit_maintenance_allowed() = 0
    BEGIN SELECT RAISE(ABORT, 'audit_logs are append-only'); END;

    CREATE TRIGGER IF NOT EXISTS audit_state_block_insert
    BEFORE INSERT ON audit_chain_state WHEN audit_maintenance_allowed() = 0
    BEGIN SELECT RAISE(ABORT, 'audit chain state is protected'); END;
    CREATE TRIGGER IF NOT EXISTS audit_state_block_update
    BEFORE UPDATE ON audit_chain_state WHEN audit_maintenance_allowed() = 0
    BEGIN SELECT RAISE(ABORT, 'audit chain state is protected'); END;
    CREATE TRIGGER IF NOT EXISTS audit_state_block_delete
    BEFORE DELETE ON audit_chain_state WHEN audit_maintenance_allowed() = 0
    BEGIN SELECT RAISE(ABORT, 'audit chain state is protected'); END;

    CREATE TRIGGER IF NOT EXISTS audit_archive_block_insert
    BEFORE INSERT ON audit_archive_batches WHEN audit_maintenance_allowed() = 0
    BEGIN SELECT RAISE(ABORT, 'audit archive history is append-only'); END;
    CREATE TRIGGER IF NOT EXISTS audit_archive_block_update
    BEFORE UPDATE ON audit_archive_batches WHEN audit_maintenance_allowed() = 0
    BEGIN SELECT RAISE(ABORT, 'audit archive history is append-only'); END;
    CREATE TRIGGER IF NOT EXISTS audit_archive_block_delete
    BEFORE DELETE ON audit_archive_batches WHEN audit_maintenance_allowed() = 0
    BEGIN SELECT RAISE(ABORT, 'audit archive history is append-only'); END;
  `);
}

function initializeAuditIntegrity() {
  const ring = loadKeyRing();
  withAuditMaintenance(() => db.transaction(() => {
    const state = db.prepare('SELECT * FROM audit_chain_state WHERE singleton_id = 1').get();
    const unsignedCount = db.prepare(`
      SELECT COUNT(*) count FROM audit_logs
      WHERE integrity_key_id = '' OR previous_hash = '' OR entry_hash = ''
    `).get().count;

    if (unsignedCount > 0) {
      const archiveCount = db.prepare('SELECT COUNT(*) count FROM audit_archive_batches').get().count;
      if (state || archiveCount > 0) throw new Error('Unsigned audit rows found after integrity initialization');

      let previousHash = GENESIS_HASH;
      let lastLogId = null;
      const rows = db.prepare('SELECT * FROM audit_logs ORDER BY id').all();
      const update = db.prepare(`
        UPDATE audit_logs
        SET integrity_version = ?, integrity_key_id = ?, previous_hash = ?, entry_hash = ?
        WHERE id = ?
      `);
      for (const row of rows) {
        const signedRow = {
          ...row,
          integrity_version: INTEGRITY_VERSION,
          integrity_key_id: ring.currentKeyId,
          previous_hash: previousHash,
        };
        signedRow.entry_hash = signLog(signedRow, ring.currentSecret);
        update.run(INTEGRITY_VERSION, ring.currentKeyId, previousHash, signedRow.entry_hash, row.id);
        previousHash = signedRow.entry_hash;
        lastLogId = row.id;
      }
      const newState = createState(lastLogId, previousHash, ring);
      db.prepare(`
        INSERT INTO audit_chain_state
          (singleton_id, last_log_id, last_entry_hash, integrity_key_id, state_hmac, updated_at)
        VALUES (1, ?, ?, ?, ?, ?)
      `).run(newState.last_log_id, newState.last_entry_hash, newState.integrity_key_id, newState.state_hmac, newState.updated_at);
    } else if (!state) {
      const last = db.prepare('SELECT id, entry_hash FROM audit_logs ORDER BY id DESC LIMIT 1').get();
      const newState = createState(last?.id ?? null, last?.entry_hash || GENESIS_HASH, ring);
      db.prepare(`
        INSERT INTO audit_chain_state
          (singleton_id, last_log_id, last_entry_hash, integrity_key_id, state_hmac, updated_at)
        VALUES (1, ?, ?, ?, ?, ?)
      `).run(newState.last_log_id, newState.last_entry_hash, newState.integrity_key_id, newState.state_hmac, newState.updated_at);
    }
  }).immediate());

  installProtectionTriggers();
  const verified = verifyAuditIntegrity({ verifyArchiveFiles: false });
  if (!verified.valid) throw new Error(`Audit integrity initialization failed: ${verified.error}`);
  auditHealth.initializedAt = Date.now();
  markSuccess();
}

export function appendAuditRecord(record) {
  const ring = loadKeyRing();
  try {
    const inserted = withAuditMaintenance(() => db.transaction(() => {
      const state = db.prepare('SELECT * FROM audit_chain_state WHERE singleton_id = 1').get();
      const stateCheck = verifySignedState(state, ring.keys);
      if (!stateCheck.valid) throw new Error(stateCheck.error);
      const latest = db.prepare('SELECT id, entry_hash FROM audit_logs ORDER BY id DESC LIMIT 1').get();
      const latestArchive = db.prepare('SELECT through_log_id, last_entry_hash FROM audit_archive_batches ORDER BY through_log_id DESC LIMIT 1').get();
      const actualLastId = latest?.id ?? latestArchive?.through_log_id ?? null;
      const actualLastHash = latest?.entry_hash ?? latestArchive?.last_entry_hash ?? GENESIS_HASH;
      if ((state.last_log_id ?? null) !== (actualLastId ?? null) || state.last_entry_hash !== actualLastHash) {
        throw new Error('AUDIT_HEAD_MISMATCH');
      }

      const row = {
        ...record,
        integrity_version: INTEGRITY_VERSION,
        integrity_key_id: ring.currentKeyId,
        previous_hash: state.last_entry_hash,
      };
      row.entry_hash = signLog(row, ring.currentSecret);
      const result = db.prepare(`
        INSERT INTO audit_logs
          (request_id, event_type, outcome, reason_code, user_id, actor_role,
           target_type, target_id, source_hash, user_agent, metadata_json, created_at,
           integrity_version, integrity_key_id, previous_hash, entry_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        row.request_id, row.event_type, row.outcome, row.reason_code,
        row.user_id ?? null, row.actor_role ?? null, row.target_type ?? null,
        row.target_id ?? null, row.source_hash, row.user_agent ?? null,
        row.metadata_json ?? null, row.created_at, row.integrity_version,
        row.integrity_key_id, row.previous_hash, row.entry_hash,
      );
      const logId = Number(result.lastInsertRowid);
      const nextState = createState(logId, row.entry_hash, ring);
      db.prepare(`
        UPDATE audit_chain_state
        SET last_log_id = ?, last_entry_hash = ?, integrity_key_id = ?, state_hmac = ?, updated_at = ?
        WHERE singleton_id = 1
      `).run(nextState.last_log_id, nextState.last_entry_hash, nextState.integrity_key_id, nextState.state_hmac, nextState.updated_at);
      return { id: logId, entryHash: row.entry_hash };
    }).immediate());
    markSuccess();
    return inserted;
  } catch (error) {
    recordAuditFailure(error);
    throw error;
  }
}

export function verifyAuditIntegrity({ verifyArchiveFiles = false } = {}) {
  const ring = loadKeyRing();
  try {
    let expectedPrevious = GENESIS_HASH;
    let lastLogId = null;
    let archivedRows = 0;
    const archives = db.prepare('SELECT * FROM audit_archive_batches ORDER BY through_log_id').all();
    for (const batch of archives) {
      const secret = ring.keys.get(batch.integrity_key_id);
      if (!secret) throw new Error(`AUDIT_ARCHIVE_KEY_UNKNOWN:${batch.id}`);
      if (!secureEqual(batch.manifest_hmac, signArchive(batch, secret))) throw new Error(`AUDIT_ARCHIVE_SIGNATURE_INVALID:${batch.id}`);
      if (batch.first_previous_hash !== expectedPrevious) throw new Error(`AUDIT_ARCHIVE_CHAIN_BROKEN:${batch.id}`);
      if (verifyArchiveFiles) {
        const manifestPath = path.resolve(/* turbopackIgnore: true */ process.cwd(), batch.manifest_path);
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const manifestMatches = manifest.version === 1
          && manifest.firstLogId === batch.first_log_id
          && manifest.throughLogId === batch.through_log_id
          && manifest.rowCount === batch.row_count
          && manifest.firstPreviousHash === batch.first_previous_hash
          && manifest.lastEntryHash === batch.last_entry_hash
          && manifest.contentSha256 === batch.content_sha256
          && manifest.integrityKeyId === batch.integrity_key_id
          && manifest.createdAt === batch.created_at
          && manifest.manifestHmac === batch.manifest_hmac;
        if (!manifestMatches) throw new Error(`AUDIT_ARCHIVE_MANIFEST_INVALID:${batch.id}`);
        const contentPath = path.resolve(path.dirname(manifestPath), manifest.contentFile);
        const contentHash = crypto.createHash('sha256').update(fs.readFileSync(contentPath)).digest('hex');
        if (contentHash !== batch.content_sha256 || contentHash !== manifest.contentSha256) {
          throw new Error(`AUDIT_ARCHIVE_CONTENT_INVALID:${batch.id}`);
        }
      }
      expectedPrevious = batch.last_entry_hash;
      lastLogId = batch.through_log_id;
      archivedRows += batch.row_count;
    }

    const rows = db.prepare('SELECT * FROM audit_logs ORDER BY id').all();
    for (const row of rows) {
      if (row.previous_hash !== expectedPrevious) throw new Error(`AUDIT_CHAIN_BROKEN:${row.id}`);
      const secret = ring.keys.get(row.integrity_key_id);
      if (!secret) throw new Error(`AUDIT_ENTRY_KEY_UNKNOWN:${row.id}`);
      if (!secureEqual(row.entry_hash, signLog(row, secret))) throw new Error(`AUDIT_ENTRY_SIGNATURE_INVALID:${row.id}`);
      expectedPrevious = row.entry_hash;
      lastLogId = row.id;
    }

    const state = db.prepare('SELECT * FROM audit_chain_state WHERE singleton_id = 1').get();
    const stateCheck = verifySignedState(state, ring.keys);
    if (!stateCheck.valid) throw new Error(stateCheck.error);
    if ((state.last_log_id ?? null) !== (lastLogId ?? null) || state.last_entry_hash !== expectedPrevious) {
      throw new Error('AUDIT_HEAD_MISMATCH');
    }
    markSuccess();
    return { valid: true, liveRows: rows.length, archivedRows, archiveBatches: archives.length, headLogId: lastLogId, headHash: expectedPrevious, keyId: state.integrity_key_id };
  } catch (error) {
    recordAuditFailure(error);
    return { valid: false, error: String(error.message || error), ...getAuditHealth() };
  }
}

export function archiveExpiredAuditLogs({ now = Date.now() } = {}) {
  const ring = loadKeyRing();
  const before = verifyAuditIntegrity({ verifyArchiveFiles: true });
  if (!before.valid) throw new Error(`Cannot archive an invalid audit chain: ${before.error}`);
  const cutoff = now - ring.config.retentionMs;
  const liveRows = db.prepare('SELECT * FROM audit_logs ORDER BY id').all();
  const rows = [];
  for (const row of liveRows) {
    if (row.created_at >= cutoff) break;
    rows.push(row);
  }
  if (rows.length === 0) return { archived: false, rowCount: 0, cutoff };

  fs.mkdirSync(ring.config.archiveDir, { recursive: true });
  const first = rows[0];
  const last = rows.at(-1);
  const baseName = `audit-${new Date(now).toISOString().replace(/[:.]/g, '-')}-through-${last.id}`;
  const contentFile = `${baseName}.jsonl`;
  const manifestFile = `${baseName}.manifest.json`;
  const contentPath = path.join(ring.config.archiveDir, contentFile);
  const manifestPath = path.join(ring.config.archiveDir, manifestFile);
  const relativeManifestPath = path.relative(process.cwd(), manifestPath).replace(/\\/g, '/');
  const content = `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`;
  const contentHash = crypto.createHash('sha256').update(content).digest('hex');
  const createdAt = Date.now();
  const batch = {
    first_log_id: first.id,
    through_log_id: last.id,
    row_count: rows.length,
    first_previous_hash: first.previous_hash,
    last_entry_hash: last.entry_hash,
    content_sha256: contentHash,
    manifest_path: relativeManifestPath,
    integrity_key_id: ring.currentKeyId,
    created_at: createdAt,
  };
  batch.manifest_hmac = signArchive(batch, ring.currentSecret);
  const manifest = {
    version: 1,
    contentFile,
    contentSha256: contentHash,
    firstLogId: first.id,
    throughLogId: last.id,
    rowCount: rows.length,
    firstPreviousHash: first.previous_hash,
    lastEntryHash: last.entry_hash,
    integrityKeyId: ring.currentKeyId,
    createdAt,
    manifestHmac: batch.manifest_hmac,
  };

  fs.writeFileSync(contentPath, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  try {
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    withAuditMaintenance(() => db.transaction(() => {
      db.prepare(`
        INSERT INTO audit_archive_batches
          (first_log_id, through_log_id, row_count, first_previous_hash, last_entry_hash,
           content_sha256, manifest_path, integrity_key_id, manifest_hmac, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        batch.first_log_id, batch.through_log_id, batch.row_count,
        batch.first_previous_hash, batch.last_entry_hash, batch.content_sha256,
        batch.manifest_path, batch.integrity_key_id, batch.manifest_hmac, batch.created_at,
      );
      const deleted = db.prepare('DELETE FROM audit_logs WHERE id BETWEEN ? AND ?').run(first.id, last.id);
      if (deleted.changes !== rows.length) throw new Error('Audit archive delete count mismatch');
    }).immediate());
  } catch (error) {
    try { fs.unlinkSync(manifestPath); } catch {}
    try { fs.unlinkSync(contentPath); } catch {}
    recordAuditFailure(error);
    throw error;
  }

  const after = verifyAuditIntegrity({ verifyArchiveFiles: true });
  if (!after.valid) throw new Error(`Audit archive verification failed: ${after.error}`);
  appendAuditRecord({
    request_id: crypto.randomUUID(), event_type: 'audit.archive', outcome: 'success',
    reason_code: 'RETENTION_ARCHIVE_COMPLETED', user_id: null, actor_role: 'system',
    target_type: 'audit_archive', target_id: String(last.id),
    source_hash: crypto.createHash('sha256').update('local-audit-maintenance').digest('hex'),
    user_agent: 'audit-maintenance',
    metadata_json: JSON.stringify({ rowCount: rows.length, throughLogId: last.id, manifestPath: relativeManifestPath }),
    created_at: Date.now(),
  });
  return { archived: true, rowCount: rows.length, throughLogId: last.id, manifestPath: relativeManifestPath, cutoff };
}

initializeAuditIntegrity();
