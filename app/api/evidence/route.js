import { withApiErrors } from '@/lib/api-errors';
import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { createSecurityContext, enforceRateLimits, RATE_LIMITS, withAudit } from '@/lib/security';
import { evidenceReviewSchema, evidenceTypeSchema, idSchema, parseJson, validate, validationErrorResponse } from '@/lib/validation';
import { malwareScan, sha256 } from '@/lib/upload-security';
import {
  MAX_EVIDENCE_SIZE, cleanupOrphanEvidence, evidenceDto, evidencePath, extractEvidence, listEvidence, removeEvidenceFiles,
  sanitizeExtraction, storeEvidenceFiles, validateEvidenceImage,
} from '@/lib/strategy-evidence';

export const dynamic = 'force-dynamic';

function rateLimit(request, user, eventType) {
  const context = createSecurityContext(request, user);
  const layers = [{ policy: RATE_LIMITS.uploadIp }];
  if (user) layers.push({ policy: RATE_LIMITS.uploadUserShort, identifier: `user:${user.id}` }, { policy: RATE_LIMITS.uploadUserDaily, identifier: `user:${user.id}` });
  return { context, response: enforceRateLimits(context, eventType, layers) };
}

async function POSTHandler(request) {
  const user = await getSessionUser();
  const limited = rateLimit(request, user, 'evidence.upload');
  if (limited.response) return limited.response;
  const audited = (response, outcome, reasonCode, metadata = {}) => withAudit(limited.context, response, { eventType: 'evidence.upload', outcome, reasonCode, metadata });
  let stored;
  try {
    if (!user) return audited(NextResponse.json({ success: false, message: '请先登录' }, { status: 401 }), 'failure', 'UNAUTHENTICATED');
    if (!['developer', 'admin'].includes(user.role)) return audited(NextResponse.json({ success: false, message: '仅开发者可上传回测证据' }, { status: 403 }), 'failure', 'FORBIDDEN_ROLE');
    cleanupOrphanEvidence();
    const form = await request.formData();
    const file = form.get('file');
    const type = validate(evidenceTypeSchema, form.get('evidenceType'));
    if (!type.success) return audited(validationErrorResponse(type.error), 'failure', 'VALIDATION_ERROR');
    if (!file || typeof file === 'string' || file.size <= 0 || file.size > MAX_EVIDENCE_SIZE) return audited(NextResponse.json({ success: false, message: '证据图片必须在 1 字节至 8MB 之间' }, { status: 400 }), 'failure', 'FILE_SIZE_INVALID');
    const originalName = String(file.name || '').slice(0, 255);
    const extension = path.extname(originalName).toLowerCase();
    const expectedMime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[extension];
    if (!expectedMime || file.type !== expectedMime) return audited(NextResponse.json({ success: false, message: '仅允许扩展名与内容一致的 PNG、JPEG 或 WebP 图片' }, { status: 400 }), 'failure', 'TYPE_NOT_ALLOWED');
    const original = Buffer.from(await file.arrayBuffer());
    const hash = sha256(original);
    const existing = db.prepare('SELECT * FROM strategy_evidence WHERE owner_user_id = ? AND content_sha256 = ? AND evidence_type = ?').get(user.id, hash, type.data);
    if (existing) {
      const unboundAndPending = existing.product_id === null && existing.review_status === 'pending';
      const filesExist = fs.existsSync(evidencePath(existing.original_stored_name)) && fs.existsSync(evidencePath(existing.preview_stored_name));
      const resumable = unboundAndPending && filesExist;
      if (resumable) return audited(NextResponse.json({ success: true, evidence: evidenceDto(existing, { admin: true }), resumed: true }), 'success', 'EVIDENCE_RESUMED', { evidenceType: type.data, evidenceId: existing.id });
      if (unboundAndPending && !filesExist) { db.prepare('DELETE FROM strategy_evidence WHERE id=? AND product_id IS NULL').run(existing.id); removeEvidenceFiles(existing); }
      else return audited(NextResponse.json({ success: false, message: '相同证据已经绑定或审核，请上传新的原始截图' }, { status: 409 }), 'failure', 'DUPLICATE_CONTENT_ATTACHED');
    }
    const validated = await validateEvidenceImage(original, expectedMime);
    const scan = await malwareScan(original, { fileName: originalName, contentType: expectedMime, sha256: hash });
    if (!scan.clean) return audited(NextResponse.json({ success: false, message: scan.reason === 'SCANNER_UNAVAILABLE' ? '安全扫描服务暂不可用' : '证据未通过安全扫描' }, { status: scan.reason === 'SCANNER_UNAVAILABLE' ? 503 : 400 }), 'failure', scan.reason);
    stored = storeEvidenceFiles(original, validated.preview, extension);
    const extraction = await extractEvidence(validated.preview, type.data, hash);
    const result = db.prepare(`INSERT INTO strategy_evidence
      (owner_user_id,evidence_type,original_name,original_stored_name,preview_stored_name,content_sha256,mime_type,size,extraction_status,extraction_json,extraction_confidence,uploaded_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(user.id, type.data, originalName, stored.originalStoredName, stored.previewStoredName, hash, expectedMime, original.length, extraction.status, extraction.fields ? JSON.stringify(extraction.fields) : null, extraction.confidence, Date.now());
    const row = db.prepare('SELECT * FROM strategy_evidence WHERE id = ?').get(Number(result.lastInsertRowid));
    return audited(NextResponse.json({ success: true, evidence: evidenceDto(row, { admin: true }) }, { status: 201 }), 'success', 'UPLOADED', { evidenceType: type.data, extractionStatus: extraction.status });
  } catch (error) {
    if (stored) removeEvidenceFiles({ original_stored_name: stored.originalStoredName, preview_stored_name: stored.previewStoredName });
    return audited(NextResponse.json({ success: false, message: '证据上传失败' }, { status: 500 }), 'failure', error.message || 'INTERNAL_ERROR');
  }
}

async function GETHandler(request) {
  try {
    const url = new URL(request.url);
    const productId = validate(idSchema, url.searchParams.get('productId'));
    if (url.searchParams.has('productId')) {
      if (!productId.success) return validationErrorResponse(productId.error);
      const product = db.prepare('SELECT status FROM products WHERE id = ?').get(productId.data);
      if (!product || product.status !== 'active') return NextResponse.json({ success: false, message: '策略不存在' }, { status: 404 });
      return NextResponse.json({ success: true, evidence: listEvidence(productId.data) });
    }
    const id = validate(idSchema, url.searchParams.get('id'));
    if (!id.success) return validationErrorResponse(id.error);
    const row = db.prepare('SELECT e.*, p.status product_status FROM strategy_evidence e LEFT JOIN products p ON p.id=e.product_id WHERE e.id=?').get(id.data);
    if (!row) return NextResponse.json({ success: false, message: '证据不存在' }, { status: 404 });
    const user = await getSessionUser();
    const allowed = row.review_status === 'approved' && row.product_status === 'active' || user?.id === row.owner_user_id || user?.role === 'admin';
    if (!allowed) return NextResponse.json({ success: false, message: '无权查看证据' }, { status: 403 });
    const content = fs.readFileSync(evidencePath(row.preview_stored_name));
    return new Response(content, { headers: { 'content-type': 'image/png', 'content-length': String(content.length), 'cache-control': 'private, no-store', 'content-disposition': 'inline', 'content-security-policy': "default-src 'none'; sandbox", 'cross-origin-resource-policy': 'same-origin', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff' } });
  } catch (error) {
    return NextResponse.json({ success: false, message: '读取证据失败' }, { status: 500 });
  }
}

async function PATCHHandler(request) {
  const user = await getSessionUser();
  const context = createSecurityContext(request, user);
  const audited = (response, outcome, reasonCode, metadata = {}) => withAudit(context, response, { eventType: 'evidence.review', outcome, reasonCode, metadata });
  if (user?.role !== 'admin') return audited(NextResponse.json({ success: false, message: '仅管理员可审核证据' }, { status: user ? 403 : 401 }), 'failure', 'FORBIDDEN');
  const parsed = await parseJson(request, evidenceReviewSchema);
  if (!parsed.success) return audited(parsed.response, 'failure', 'VALIDATION_ERROR');
  const row = db.prepare('SELECT * FROM strategy_evidence WHERE id=?').get(parsed.data.id);
  if (!row) return audited(NextResponse.json({ success: false, message: '证据不存在' }, { status: 404 }), 'failure', 'NOT_FOUND');
  const corrected = parsed.data.correctedExtraction ? sanitizeExtraction(parsed.data.correctedExtraction) : null;
  let extractionJson = corrected ? JSON.stringify(corrected) : row.extraction_json;
  let reportDerived = false;
  if (parsed.data.status === 'approved' && row.evidence_type === 'statistics' && !extractionJson && row.product_id) {
    const report = db.prepare('SELECT extracted_json FROM strategy_reports WHERE product_id=?').get(row.product_id);
    if (report) {
      const extracted = JSON.parse(report.extracted_json);
      extractionJson = JSON.stringify({ source: 'mt5_html_report', initialDeposit: extracted.initialDeposit, netProfit: extracted.netProfit, profitFactor: extracted.profitFactor, sharpeRatio: extracted.sharpeRatio, maxDrawdownPercent: extracted.maxDrawdownPercent, recoveryFactor: extracted.recoveryFactor, winRatePercent: extracted.winRatePercent, totalTrades: extracted.totalTrades });
      reportDerived = true;
    }
  }
  if (parsed.data.status === 'approved' && row.evidence_type === 'statistics' && !extractionJson) {
    return audited(NextResponse.json({ success: false, message: '统计截图必须先完成自动提取或由管理员录入校正数据' }, { status: 409 }), 'failure', 'EXTRACTION_REQUIRED');
  }
  const result = db.prepare(`UPDATE strategy_evidence SET review_status=?, rejection_reason=?, extraction_json=?, extraction_status=?, extraction_confidence=?, reviewed_at=?, reviewed_by_user_id=?
    WHERE id=? AND review_status='pending'`).run(parsed.data.status, parsed.data.rejectionReason || null, extractionJson, corrected || reportDerived ? 'completed' : row.extraction_status, corrected || reportDerived ? 1 : row.extraction_confidence, Date.now(), user.id, row.id);
  if (result.changes !== 1) return audited(NextResponse.json({ success: false, message: '证据已审核，重复操作未生效' }, { status: 409 }), 'blocked', 'ALREADY_REVIEWED');
  return audited(NextResponse.json({ success: true }), 'success', parsed.data.status.toUpperCase(), { evidenceId: row.id, corrected: Boolean(corrected), reportDerived });
}

export const POST = withApiErrors(POSTHandler, { route: '/api/evidence' });
export const GET = withApiErrors(GETHandler, { route: '/api/evidence' });
export const PATCH = withApiErrors(PATCHHandler, { route: '/api/evidence' });
