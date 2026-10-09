import { withApiErrors } from '@/lib/api-errors';
import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import db from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { forumAccess } from '@/lib/forum-feature';
import { idSchema, parseJson, uploadMetadataSchema, validate, validationErrorResponse } from '@/lib/validation';
import { createSecurityContext, enforceRateLimits, RATE_LIMITS, withAudit } from '@/lib/security';
import { cleanupExpiredPostAttachments, malwareScan, sha256, storedPostAttachmentPath, uploadRoots, validateAndNormalizeImage } from '@/lib/upload-security';

export const dynamic = 'force-dynamic';
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_USER_FILES = 20;
const MAX_USER_BYTES = 250 * 1024 * 1024;
const DELETE_SCHEMA = z.object({ id: idSchema }).strict();

function classifyFile(fileName) {
  const extension = path.extname(fileName).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.webp'].includes(extension)) return { kind: 'image', extension, mime: extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : 'image/jpeg' };
  if (extension === '.pdf') return { kind: 'file', extension, mime: 'application/pdf' };
  if (extension === '.csv') return { kind: 'file', extension, mime: 'text/csv' };
  if (extension === '.txt') return { kind: 'file', extension, mime: 'text/plain' };
  return null;
}

function safeDocumentBytes(buffer, mime) {
  if (mime === 'application/pdf') return buffer.length >= 8 && buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return !text.includes('\0') && !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/u.test(text);
  } catch { return false; }
}

function audit(context, response, outcome, reasonCode, metadata = {}) {
  return withAudit(context, response, { eventType: 'post_attachment.write', outcome, reasonCode, metadata });
}

async function POSTHandler(request) {
  if (!forumAccess().enabled) return NextResponse.json({ success: false, message: '论坛已关闭上传', code: 'FORUM_DISABLED' }, { status: 403 });
  const user = await getSessionUser();
  const context = createSecurityContext(request, user);
  const layers = [{ policy: RATE_LIMITS.uploadIp }];
  if (user) layers.push({ policy: RATE_LIMITS.uploadUserShort, identifier: `user:${user.id}` }, { policy: RATE_LIMITS.uploadUserDaily, identifier: `user:${user.id}` });
  const limited = enforceRateLimits(context, 'post_attachment.upload', layers);
  if (limited) return limited;
  try {
    if (!user) return audit(context, NextResponse.json({ success: false, message: '请先登录后再上传' }, { status: 401 }), 'failure', 'UNAUTHENTICATED');
    cleanupExpiredPostAttachments();
    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') return audit(context, NextResponse.json({ success: false, message: '请选择要上传的图片或附件' }, { status: 400 }), 'failure', 'MISSING_FILE');
    const meta = validate(uploadMetadataSchema, { name: file.name || '', size: file.size, type: file.type || '' });
    if (!meta.success) return audit(context, validationErrorResponse(meta.error), 'failure', 'VALIDATION_ERROR');
    const classification = classifyFile(meta.data.name);
    if (!classification) return audit(context, NextResponse.json({ success: false, message: '仅支持 PNG、JPG、WebP 图片及 PDF、CSV、TXT 附件' }, { status: 400 }), 'failure', 'FILE_TYPE_NOT_ALLOWED');
    const maxBytes = classification.kind === 'image' ? MAX_IMAGE_BYTES : MAX_FILE_BYTES;
    if (meta.data.size < 1 || meta.data.size > maxBytes) return audit(context, NextResponse.json({ success: false, message: `该类文件最大支持 ${maxBytes / 1024 / 1024}MB` }, { status: 400 }), 'failure', 'FILE_SIZE_INVALID', { kind: classification.kind, size: meta.data.size });
    const quota = db.prepare(`SELECT COUNT(*) count,COALESCE(SUM(size),0) bytes FROM post_attachments WHERE owner_user_id=?`).get(user.id);
    if (quota.count >= MAX_USER_FILES || quota.bytes + meta.data.size > MAX_USER_BYTES) return audit(context, NextResponse.json({ success: false, message: '你的图片与附件存储空间已达到上限' }, { status: 409 }), 'failure', 'USER_STORAGE_EXCEEDED');

    const input = Buffer.from(await file.arrayBuffer());
    let content;
    try {
      if (classification.kind === 'image') content = await validateAndNormalizeImage(input, classification.mime.slice(6));
      else if (!safeDocumentBytes(input, classification.mime)) throw new Error('FILE_CONTENT_MISMATCH');
      else content = input;
    } catch {
      return audit(context, NextResponse.json({ success: false, message: '文件内容与扩展名不符，或图片无法解码' }, { status: 400 }), 'failure', 'CONTENT_VALIDATION_FAILED', { kind: classification.kind });
    }
    const contentHash = sha256(content);
    const scan = await malwareScan(content, { fileName: meta.data.name, contentType: classification.mime, sha256: contentHash });
    if (!scan.clean) return audit(context, NextResponse.json({ success: false, message: scan.reason === 'SCANNER_UNAVAILABLE' ? '安全扫描服务暂不可用，请稍后重试' : '文件未通过安全扫描' }, { status: scan.reason === 'SCANNER_UNAVAILABLE' ? 503 : 400 }), 'failure', scan.reason, { kind: classification.kind });

    const storedName = `${Date.now()}_${crypto.randomBytes(16).toString('hex')}${classification.extension}`;
    if (!forumAccess().enabled) return audit(context, NextResponse.json({ success: false, message: '论坛已关闭上传', code: 'FORUM_DISABLED' }, { status: 403 }), 'failure', 'FORUM_DISABLED');
    const fullPath = storedPostAttachmentPath(storedName);
    fs.mkdirSync(uploadRoots().postAttachmentRoot, { recursive: true });
    fs.writeFileSync(fullPath, content, { flag: 'wx', mode: 0o600 });
    try {
      const result = db.prepare(`INSERT INTO post_attachments(owner_user_id,post_id,kind,original_name,stored_name,content_sha256,mime_type,size,status,created_at,expires_at)
        VALUES(?,NULL,?,?,?,?,?,?,?,?,?)`).run(user.id, classification.kind, meta.data.name, storedName, contentHash, classification.mime, content.length, scan.status, Date.now(), Date.now() + 7 * 24 * 60 * 60 * 1000);
      const id = Number(result.lastInsertRowid);
      return audit(context, NextResponse.json({ success: true, attachment: { id, kind: classification.kind, name: meta.data.name, mimeType: classification.mime, size: content.length, url: `/api/post-attachments?id=${id}` } }, { status: 201 }), 'success', 'UPLOADED', { attachmentId: id, kind: classification.kind, size: content.length });
    } catch (error) {
      fs.rmSync(fullPath, { force: true });
      throw error;
    }
  } catch {
    return audit(context, NextResponse.json({ success: false, message: '上传失败，请稍后重试' }, { status: 500 }), 'failure', 'INTERNAL_ERROR');
  }
}

async function GETHandler(request) {
  const { searchParams } = new URL(request.url);
  const parsedId = validate(idSchema, searchParams.get('id'));
  if (!parsedId.success) return validationErrorResponse(parsedId.error);
  const user = await getSessionUser();
  const row = db.prepare(`SELECT a.*,p.moderation_status FROM post_attachments a LEFT JOIN posts p ON p.id=a.post_id
    WHERE a.id=? AND a.status IN ('clean','content_validated') AND ((a.owner_user_id=? AND (a.expires_at IS NULL OR a.expires_at>?)) OR p.moderation_status='visible')`).get(parsedId.data, user?.id || -1, Date.now());
  if (!row) return new NextResponse('附件不存在或无权访问', { status: 404 });
  if (row.post_id && !forumAccess().readable && user?.role !== 'admin') return new NextResponse('论坛已停用', { status: 404 });
  const fullPath = storedPostAttachmentPath(row.stored_name);
  if (!fs.existsSync(fullPath)) return new NextResponse('附件文件不存在', { status: 404 });
  const data = fs.readFileSync(fullPath);
  const isImage = row.kind === 'image';
  const safeName = encodeURIComponent(row.original_name).replace(/['()]/g, escape => `%${escape.charCodeAt(0).toString(16)}`);
  return new NextResponse(data, { status: 200, headers: {
    'Content-Type': isImage ? row.mime_type : 'application/octet-stream',
    'Content-Disposition': `${isImage ? 'inline' : 'attachment'}; filename="attachment"; filename*=UTF-8''${safeName}`,
    'Content-Length': String(data.length), 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store',
  } });
}

async function DELETEHandler(request) {
  const user = await getSessionUser();
  const context = createSecurityContext(request, user);
  const limited = enforceRateLimits(context, 'post_attachment.delete', [{ policy: RATE_LIMITS.uploadIp }, ...(user ? [{ policy: RATE_LIMITS.uploadUserShort, identifier: `user:${user.id}` }] : [])]);
  if (limited) return limited;
  if (!user) return audit(context, NextResponse.json({ success: false, message: '请先登录' }, { status: 401 }), 'failure', 'UNAUTHENTICATED');
  const parsed = await parseJson(request, DELETE_SCHEMA);
  if (!parsed.success) return audit(context, parsed.response, 'failure', 'VALIDATION_ERROR');
  const row = db.prepare('SELECT id,stored_name FROM post_attachments WHERE id=? AND owner_user_id=? AND post_id IS NULL').get(parsed.data.id, user.id);
  if (!row) return audit(context, NextResponse.json({ success: false, message: '附件不存在或已随帖子发布' }, { status: 404 }), 'failure', 'ATTACHMENT_NOT_REMOVABLE', { attachmentId: parsed.data.id });
  const removed = db.prepare('DELETE FROM post_attachments WHERE id=? AND owner_user_id=? AND post_id IS NULL').run(row.id, user.id);
  if (removed.changes !== 1) return audit(context, NextResponse.json({ success: false, message: '附件已被使用，不能删除' }, { status: 409 }), 'failure', 'ATTACHMENT_STATE_CHANGED', { attachmentId: parsed.data.id });
  fs.rmSync(storedPostAttachmentPath(row.stored_name), { force: true });
  return audit(context, NextResponse.json({ success: true }), 'success', 'ATTACHMENT_REMOVED', { attachmentId: parsed.data.id });
}

export const POST = withApiErrors(POSTHandler, { route: '/api/post-attachments' });
export const GET = withApiErrors(GETHandler, { route: '/api/post-attachments' });
export const DELETE = withApiErrors(DELETEHandler, { route: '/api/post-attachments' });
