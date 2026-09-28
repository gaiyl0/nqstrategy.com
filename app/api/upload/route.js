import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getSessionUser } from '@/lib/auth';
import db from '@/lib/db';
import { uploadMetadataSchema, validate, validationErrorResponse } from '@/lib/validation';
import { createSecurityContext, enforceRateLimits, RATE_LIMITS, withAudit } from '@/lib/security';
import {
  classifyUpload, cleanupExpiredUploads, enforceUploadQuota, malwareScan,
  MAX_EA_SIZE, MAX_IMAGE_SIZE, ORPHAN_TTL_MS, registerUpload, sha256, storedPath,
  validateAndNormalizeImage, validateCompiledEA,
} from '@/lib/upload-security';

export const dynamic = 'force-dynamic';

const ERROR_MESSAGES = {
  IMAGE_CONTENT_MISMATCH: '图片内容与扩展名不一致或无法解码',
  IMAGE_DIMENSIONS_NOT_ALLOWED: '图片尺寸无效、像素过大或包含动画',
  EA_CONTENT_MISMATCH: 'EA 文件内容与 EX4/EX5 格式不一致',
  EA_EXECUTABLE_OR_ARCHIVE_REJECTED: '拒绝压缩包、脚本或系统可执行文件',
  PENDING_UPLOAD_COUNT_EXCEEDED: '未发布上传数量已达上限，请先发布或等待过期清理',
  PENDING_UPLOAD_BYTES_EXCEEDED: '未发布上传占用空间已达上限',
  USER_STORAGE_EXCEEDED: '账户文件总容量已达上限',
};

export async function POST(request) {
  const currentUser = await getSessionUser();
  const context = createSecurityContext(request, currentUser);
  const layers = [{ policy: RATE_LIMITS.uploadIp }];
  if (currentUser) layers.push(
    { policy: RATE_LIMITS.uploadUserShort, identifier: `user:${currentUser.id}` },
    { policy: RATE_LIMITS.uploadUserDaily, identifier: `user:${currentUser.id}` },
  );
  const limited = enforceRateLimits(context, 'upload.write', layers);
  if (limited) return limited;
  const audited = (response, outcome, reasonCode, metadata = {}) => withAudit(context, response, {
    eventType: 'upload.write', outcome, reasonCode, metadata,
  });

  try {
    if (!currentUser) return audited(NextResponse.json({ success: false, message: '请先登录后再上传文件' }, { status: 401 }), 'failure', 'UNAUTHENTICATED');
    cleanupExpiredUploads();
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') return audited(NextResponse.json({ success: false, message: '请选择有效的文件' }, { status: 400 }), 'failure', 'MISSING_FILE');

    const metadata = validate(uploadMetadataSchema, { name: file.name || '', size: file.size, type: file.type || '' });
    if (!metadata.success) return audited(validationErrorResponse(metadata.error), 'failure', 'VALIDATION_ERROR');
    const originalName = metadata.data.name;
    const classification = classifyUpload(path.extname(originalName));
    if (!classification) return audited(NextResponse.json({
      success: false, message: '仅允许 PNG、JPEG、WebP 图片或已编译的 EX4/EX5 策略文件',
    }, { status: 400 }), 'failure', 'EXTENSION_NOT_ALLOWED');
    if (classification.kind === 'ea' && !['developer', 'admin'].includes(currentUser.role)) {
      return audited(NextResponse.json({ success: false, message: '仅认证开发者可上传 EA 程序' }, { status: 403 }), 'failure', 'FORBIDDEN_ROLE', { kind: 'ea' });
    }
    const maxSize = classification.kind === 'image' ? MAX_IMAGE_SIZE : MAX_EA_SIZE;
    if (metadata.data.size <= 0 || metadata.data.size > maxSize) return audited(NextResponse.json({
      success: false, message: `文件体积必须在 1 字节至 ${maxSize / 1024 / 1024}MB 之间`,
    }, { status: 400 }), 'failure', 'FILE_SIZE_INVALID', { kind: classification.kind, size: metadata.data.size });

    enforceUploadQuota(currentUser.id, metadata.data.size);
    const input = Buffer.from(await file.arrayBuffer());
    let content;
    try {
      content = classification.kind === 'image'
        ? await validateAndNormalizeImage(input, classification.format)
        : validateCompiledEA(input, classification.format);
    } catch (error) {
      const reason = ERROR_MESSAGES[error.message] ? error.message : 'CONTENT_VALIDATION_FAILED';
      return audited(NextResponse.json({ success: false, message: ERROR_MESSAGES[reason] || '文件内容验证失败' }, { status: 400 }), 'failure', reason, { kind: classification.kind });
    }

    const contentHash = sha256(content);
    const existing = db.prepare(`SELECT id,url,stored_name,status,attached_product_id FROM uploads
      WHERE owner_user_id = ? AND kind = ? AND content_sha256 = ? AND deleted_at IS NULL
      ORDER BY id DESC LIMIT 1`).get(currentUser.id, classification.kind, contentHash);
    if (existing) {
      const unboundAndValid = existing.attached_product_id === null && ['clean', 'content_validated'].includes(existing.status);
      const storedFileExists = existing.stored_name && fs.existsSync(storedPath(classification.kind, existing.stored_name));
      const resumable = unboundAndValid && storedFileExists;
      if (resumable) return audited(NextResponse.json({ success: true, url: existing.url, resumed: true }), 'success', 'UPLOAD_RESUMED', { kind: classification.kind, uploadId: existing.id });
      if (unboundAndValid && !storedFileExists) db.prepare("UPDATE uploads SET deleted_at=?,status='deleted' WHERE id=? AND attached_product_id IS NULL").run(Date.now(), existing.id);
      else return audited(NextResponse.json({ success: false, message: '相同文件已经绑定到其他提交，请选择新文件' }, { status: 409 }), 'failure', 'DUPLICATE_CONTENT_ATTACHED', { kind: classification.kind });
    }

    const scan = await malwareScan(content, { fileName: originalName, contentType: file.type || 'application/octet-stream', sha256: contentHash });
    if (!scan.clean) {
      const unavailable = scan.reason === 'SCANNER_UNAVAILABLE';
      return audited(NextResponse.json({ success: false, message: unavailable ? '文件安全扫描服务暂不可用，请稍后重试' : '文件未通过安全扫描' }, { status: unavailable ? 503 : 400 }), 'failure', scan.reason, { kind: classification.kind });
    }

    const extension = classification.kind === 'image' ? { png: '.png', jpeg: '.jpg', webp: '.webp' }[classification.format] : classification.extension;
    const storedName = `${Date.now()}_${crypto.randomBytes(16).toString('hex')}${extension}`;
    const url = classification.kind === 'image' ? `/uploads/${storedName}` : `/private/eas/${storedName}`;
    const fullPath = storedPath(classification.kind, storedName);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, { flag: 'wx', mode: 0o600 });
    try {
      registerUpload({
        ownerUserId: currentUser.id, url, kind: classification.kind, originalName,
        size: content.length, storedName, contentSha256: contentHash,
        mimeType: classification.kind === 'image' ? `image/${classification.format}` : 'application/octet-stream',
        status: scan.status, expiresAt: Date.now() + ORPHAN_TTL_MS,
      });
    } catch (error) {
      fs.rmSync(fullPath, { force: true });
      throw error;
    }
    return audited(NextResponse.json({ success: true, url }), 'success', 'UPLOADED', { kind: classification.kind, size: content.length, extension, scanStatus: scan.status });
  } catch (error) {
    if (error.message === 'DUPLICATE_CONTENT') return audited(NextResponse.json({ success: false, message: '相同文件已经上传' }, { status: 409 }), 'failure', 'DUPLICATE_CONTENT');
    if (ERROR_MESSAGES[error.message]) return audited(NextResponse.json({ success: false, message: ERROR_MESSAGES[error.message] }, { status: 409 }), 'failure', error.message);
    console.error('文件上传异常:', error);
    return audited(NextResponse.json({ success: false, message: '文件写入失败，请稍后重试' }, { status: 500 }), 'failure', 'INTERNAL_ERROR');
  }
}
