import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-strategy-evidence-'));
process.env.NODE_ENV = 'test';
process.env.NEXUS_DB_PATH = path.join(root, 'test.db');
process.env.NEXUS_EVIDENCE_ROOT = path.join(root, 'evidence');
let db;
try {
  const evidence = await import('../lib/strategy-evidence.js');
  const dbModule = await import('../lib/db.js'); db = dbModule.default;
  assert.deepEqual(evidence.sanitizeExtraction({ initialDeposit: 1000, bad: { nested: true }, '$bad': 2 }), { initialDeposit: 1000 });
  const image = await sharp({ create: { width: 100, height: 50, channels: 3, background: '#ffffff' } }).png().toBuffer();
  const checked = await evidence.validateEvidenceImage(image, 'image/png');
  assert.ok(checked.preview.length > 0);
  const manual = await evidence.extractEvidence(checked.preview, 'statistics', 'a'.repeat(64));
  assert.equal(manual.status, 'manual_review');
  const ownerId = Number(db.prepare("INSERT INTO users(username,email,role,password) VALUES('dev','dev@test.invalid','developer','x')").run().lastInsertRowid);
  const otherId = Number(db.prepare("INSERT INTO users(username,email,role,password) VALUES('other','other@test.invalid','developer','x')").run().lastInsertRowid);
  const productId = Number(db.prepare("INSERT INTO products(title,author,author_user_id,status) VALUES('EA','dev',?,'pending')").run(ownerId).lastInsertRowid);
  const insert = db.prepare(`INSERT INTO strategy_evidence(owner_user_id,evidence_type,original_name,original_stored_name,preview_stored_name,content_sha256,mime_type,size,extraction_status,extraction_json,uploaded_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`);
  const ids = ['settings','statistics','chart'].map((type, index) => Number(insert.run(ownerId,type,`${type}.png`,`o${index}.png`,`p${index}.png`,String(index).repeat(64),'image/png',100,'completed',type === 'statistics' ? JSON.stringify({ initialDeposit:10000,netProfit:1500,profitFactor:1.8,sharpeRatio:1.4,maxDrawdownPercent:8.5,recoveryFactor:2.2,winRatePercent:64.5,totalTrades:250 }) : '{}',Date.now()).lastInsertRowid));
  evidence.claimEvidence(productId, ownerId, ids);
  assert.equal(evidence.listEvidence(productId).length, 0);
  assert.throws(() => evidence.claimEvidence(productId, otherId, ids), /EVIDENCE_OWNERSHIP_INVALID/);
  db.prepare("UPDATE strategy_evidence SET review_status='approved' WHERE product_id=?").run(productId);
  assert.equal(evidence.listEvidence(productId).length, 3);
  const metrics = { initialDeposit:10000,netProfit:1500,profitFactor:1.8,sharpeRatio:1.4,maxDrawdownPercent:8.5,recoveryFactor:2.2,winRatePercent:64.5,totalTrades:250 };
  assert.equal(evidence.verifyEvidenceForApproval(productId, metrics), true);
  assert.throws(() => evidence.verifyEvidenceForApproval(productId, { ...metrics, totalTrades: 251 }), /EVIDENCE_METRICS_MISMATCH/);
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
  console.log(JSON.stringify({ success: true, assertions: 9 }));
} finally {
  db?.close();
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
