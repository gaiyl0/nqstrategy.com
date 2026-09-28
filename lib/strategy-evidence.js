import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import db from './db.js';

export const REQUIRED_EVIDENCE_TYPES = ['settings', 'statistics', 'chart'];
export const MAX_EVIDENCE_SIZE = 8 * 1024 * 1024;

export function evidenceRoot() {
  const configured = process.env.NEXUS_EVIDENCE_ROOT;
  return configured
    ? path.resolve(/* turbopackIgnore: true */ configured)
    : path.join(process.cwd(), 'storage', 'private', 'evidence');
}

export function evidencePath(storedName) {
  const root = evidenceRoot();
  const target = path.resolve(root, path.basename(storedName));
  if (path.dirname(target) !== root) throw new Error('INVALID_EVIDENCE_PATH');
  return target;
}

export async function validateEvidenceImage(buffer, mimeType) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(mimeType)) throw new Error('EVIDENCE_TYPE_NOT_ALLOWED');
  const image = sharp(buffer, { failOn: 'error', limitInputPixels: 30_000_000 });
  const metadata = await image.metadata();
  const expected = { 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/webp': 'webp' }[mimeType];
  if (metadata.format !== expected || !metadata.width || !metadata.height || (metadata.pages || 1) !== 1
    || metadata.width > 8192 || metadata.height > 8192) throw new Error('EVIDENCE_IMAGE_INVALID');
  const preview = await image.rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9 }).toBuffer();
  return { preview, width: metadata.width, height: metadata.height };
}

export function sanitizeExtraction(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const output = {};
  for (const [key, value] of Object.entries(input).slice(0, 40)) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,49}$/.test(key)) continue;
    if (value === null || typeof value === 'boolean') output[key] = value;
    else if (typeof value === 'number' && Number.isFinite(value)) output[key] = value;
    else if (typeof value === 'string') output[key] = value.slice(0, 500);
  }
  return Object.keys(output).length ? output : null;
}

export async function extractEvidence(preview, evidenceType, contentHash) {
  const url = String(process.env.EVIDENCE_OCR_URL || '').trim();
  if (!url) return { status: 'manual_review', fields: null, confidence: null };
  try {
    const response = await fetch(url, {
      method: 'POST', body: preview, cache: 'no-store', signal: AbortSignal.timeout(20_000),
      headers: {
        'content-type': 'image/png', 'x-evidence-type': evidenceType, 'x-evidence-sha256': contentHash,
        ...(process.env.EVIDENCE_OCR_TOKEN ? { authorization: `Bearer ${process.env.EVIDENCE_OCR_TOKEN}` } : {}),
      },
    });
    if (!response.ok) return { status: 'failed', fields: null, confidence: null };
    const payload = await response.json();
    const fields = sanitizeExtraction(payload?.fields);
    const confidence = Number(payload?.confidence);
    if (!fields || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      return { status: 'failed', fields: null, confidence: null };
    }
    return { status: 'completed', fields, confidence };
  } catch {
    return { status: 'manual_review', fields: null, confidence: null };
  }
}

export function storeEvidenceFiles(original, preview, extension) {
  const root = evidenceRoot();
  fs.mkdirSync(root, { recursive: true });
  const token = `${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
  const originalStoredName = `${token}.original${extension}`;
  const previewStoredName = `${token}.preview.png`;
  fs.writeFileSync(evidencePath(originalStoredName), original, { flag: 'wx', mode: 0o600 });
  try { fs.writeFileSync(evidencePath(previewStoredName), preview, { flag: 'wx', mode: 0o600 }); }
  catch (error) { fs.rmSync(evidencePath(originalStoredName), { force: true }); throw error; }
  return { originalStoredName, previewStoredName };
}

export function removeEvidenceFiles(record) {
  for (const name of [record?.original_stored_name, record?.preview_stored_name].filter(Boolean)) {
    try { fs.rmSync(evidencePath(name), { force: true }); } catch {}
  }
}

export function cleanupOrphanEvidence(now = Date.now()) {
  const rows = db.prepare('SELECT * FROM strategy_evidence WHERE product_id IS NULL AND uploaded_at <= ?').all(now - 24 * 60 * 60 * 1000);
  let removed = 0;
  const remove = db.prepare('DELETE FROM strategy_evidence WHERE id = ? AND product_id IS NULL');
  for (const row of rows) {
    if (remove.run(row.id).changes === 1) { removeEvidenceFiles(row); removed += 1; }
  }
  return removed;
}

function parseFields(value) {
  try { return sanitizeExtraction(JSON.parse(value || 'null')); } catch { return null; }
}

export function evidenceDto(row, { admin = false } = {}) {
  const dto = {
    id: row.id, type: row.evidence_type, extractionStatus: row.extraction_status,
    confidence: row.extraction_confidence, reviewStatus: row.review_status,
    sha256: row.content_sha256, uploadedAt: row.uploaded_at,
    previewUrl: `/api/evidence?id=${row.id}&preview=1`,
  };
  if (admin) Object.assign(dto, { originalName: row.original_name, extraction: parseFields(row.extraction_json), rejectionReason: row.rejection_reason });
  return dto;
}

export function listEvidence(productId, { admin = false } = {}) {
  const rows = db.prepare(`SELECT * FROM strategy_evidence WHERE product_id = ? ${admin ? '' : "AND review_status = 'approved'"} ORDER BY evidence_type`).all(productId);
  return rows.map((row) => evidenceDto(row, { admin }));
}

export function claimEvidence(productId, ownerUserId, evidenceIds) {
  const placeholders = evidenceIds.map(() => '?').join(',');
  const rows = db.prepare(`SELECT * FROM strategy_evidence WHERE id IN (${placeholders})`).all(...evidenceIds);
  if (rows.length !== evidenceIds.length || rows.some((row) => row.owner_user_id !== ownerUserId || (row.product_id !== null && row.product_id !== productId))) {
    throw new Error('EVIDENCE_OWNERSHIP_INVALID');
  }
  const types = new Set(rows.map((row) => row.evidence_type));
  if (types.size !== rows.length || REQUIRED_EVIDENCE_TYPES.some((type) => !types.has(type))) throw new Error('EVIDENCE_SET_INCOMPLETE');
  db.prepare('UPDATE strategy_evidence SET product_id = NULL WHERE product_id = ?').run(productId);
  const claim = db.prepare(`UPDATE strategy_evidence SET product_id = ? WHERE id = ? AND owner_user_id = ? AND product_id IS NULL`);
  for (const row of rows) if (claim.run(productId, row.id, ownerUserId).changes !== 1) throw new Error('EVIDENCE_ALREADY_USED');
}

const FIELD_MAP = {
  initialDeposit: 'initialDeposit', netProfit: 'netProfit', profitFactor: 'profitFactor', sharpeRatio: 'sharpeRatio',
  maxDrawdownPercent: 'maxDrawdownPercent', recoveryFactor: 'recoveryFactor', winRatePercent: 'winRatePercent', totalTrades: 'totalTrades',
};

export function verifyEvidenceForApproval(productId, metrics) {
  const rows = db.prepare('SELECT * FROM strategy_evidence WHERE product_id = ?').all(productId);
  for (const type of REQUIRED_EVIDENCE_TYPES) {
    if (!rows.some((row) => row.evidence_type === type && row.review_status === 'approved')) throw new Error('EVIDENCE_APPROVAL_REQUIRED');
  }
  const statistics = rows.find((row) => row.evidence_type === 'statistics');
  const fields = parseFields(statistics?.extraction_json);
  if (!fields) throw new Error('STATISTICS_EXTRACTION_REQUIRED');
  const mismatches = [];
  for (const [field, metricField] of Object.entries(FIELD_MAP)) {
    if (fields[field] === undefined) continue;
    const expected = Number(metrics[metricField]);
    const actual = Number(fields[field]);
    const tolerance = field === 'totalTrades' ? 0 : Math.max(0.01, Math.abs(expected) * 0.005);
    if (!Number.isFinite(actual) || Math.abs(actual - expected) > tolerance) mismatches.push(field);
  }
  if (Object.keys(FIELD_MAP).every((field) => fields[field] === undefined)) throw new Error('STATISTICS_EXTRACTION_REQUIRED');
  if (mismatches.length) { const error = new Error('EVIDENCE_METRICS_MISMATCH'); error.fields = mismatches; throw error; }
  return true;
}
