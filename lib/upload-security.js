import { brandImageReferences } from './page-content.mjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import db from './db.js';

export const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
export const MAX_EA_SIZE = 20 * 1024 * 1024;
export const MAX_PENDING_UPLOADS = 10;
export const MAX_PENDING_BYTES = 50 * 1024 * 1024;
export const MAX_USER_STORAGE_BYTES = 250 * 1024 * 1024;
export const ORPHAN_TTL_MS = 24 * 60 * 60 * 1000;

const IMAGE_FORMATS = new Map([
  ['.png', 'png'], ['.jpg', 'jpeg'], ['.jpeg', 'jpeg'], ['.webp', 'webp'],
]);
const EA_FORMATS = new Map([['.ex4', 'EX4'], ['.ex5', 'EX5']]);

export function uploadRoots() {
  return {
    publicRoot: path.resolve(/* turbopackIgnore: true */ process.env.NEXUS_PUBLIC_UPLOAD_ROOT || path.join(process.cwd(), 'public', 'uploads')),
    privateRoot: path.resolve(/* turbopackIgnore: true */ process.env.NEXUS_STORAGE_ROOT || path.join(process.cwd(), 'storage', 'private', 'eas')),
    postAttachmentRoot: path.resolve(/* turbopackIgnore: true */ process.env.NEXUS_STORAGE_ROOT || path.join(process.cwd(), 'storage', 'private', 'eas'), '..', 'post-attachments'),
  };
}

export function storedPostAttachmentPath(storedName) {
  const root = uploadRoots().postAttachmentRoot;
  const target = path.resolve(root, path.basename(storedName));
  if (path.dirname(target) !== root) throw new Error('INVALID_STORED_PATH');
  return target;
}

export function classifyUpload(extension) {
  const ext = String(extension).toLowerCase();
  if (IMAGE_FORMATS.has(ext)) return { kind: 'image', format: IMAGE_FORMATS.get(ext), extension: ext };
  if (EA_FORMATS.has(ext)) return { kind: 'ea', format: EA_FORMATS.get(ext), extension: ext };
  return null;
}

export async function validateAndNormalizeImage(buffer, expectedFormat) {
  const image = sharp(buffer, { failOn: 'error', limitInputPixels: 16_777_216, animated: false });
  const metadata = await image.metadata();
  if (metadata.format !== expectedFormat || !metadata.width || !metadata.height) {
    throw new Error('IMAGE_CONTENT_MISMATCH');
  }
  if ((metadata.pages || 1) !== 1 || metadata.width > 4096 || metadata.height > 4096) {
    throw new Error('IMAGE_DIMENSIONS_NOT_ALLOWED');
  }
  const rotated = image.rotate();
  if (expectedFormat === 'png') return rotated.png({ compressionLevel: 9 }).toBuffer();
  if (expectedFormat === 'jpeg') return rotated.jpeg({ quality: 88, mozjpeg: true }).toBuffer();
  return rotated.webp({ quality: 88 }).toBuffer();
}

export function validateCompiledEA(buffer, expectedMagic) {
  if (buffer.length < 64 || buffer.subarray(0, 3).toString('ascii') !== expectedMagic) {
    throw new Error('EA_CONTENT_MISMATCH');
  }
  const forbidden = [
    Buffer.from('MZ'), Buffer.from([0x7f, 0x45, 0x4c, 0x46]),
    Buffer.from('PK\x03\x04', 'binary'), Buffer.from('#!'), Buffer.from('<script', 'ascii'),
  ];
  if (forbidden.some((signature) => buffer.subarray(0, signature.length).equals(signature))) {
    throw new Error('EA_EXECUTABLE_OR_ARCHIVE_REJECTED');
  }
  return buffer;
}

export async function malwareScan(buffer, { fileName, contentType, sha256 }) {
  const scanUrl = String(process.env.UPLOAD_SCAN_URL || '').trim();
  const scanToken = String(process.env.UPLOAD_SCAN_TOKEN || '');
  if (!scanUrl) {
    if (process.env.NODE_ENV === 'production') return { clean: false, reason: 'SCANNER_UNAVAILABLE' };
    return { clean: true, status: 'content_validated' };
  }
  try {
    const response = await fetch(scanUrl, {
      method: 'POST',
      headers: {
        'content-type': contentType,
        'x-upload-file-name': encodeURIComponent(fileName),
        'x-upload-sha256': sha256,
        ...(scanToken ? { authorization: `Bearer ${scanToken}` } : {}),
      },
      body: buffer,
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    });
    if (!response.ok) return { clean: false, reason: 'SCANNER_UNAVAILABLE' };
    const result = await response.json();
    return result?.clean === true
      ? { clean: true, status: 'clean' }
      : { clean: false, reason: result?.reason === 'malware' ? 'MALWARE_DETECTED' : 'SCAN_REJECTED' };
  } catch {
    return { clean: false, reason: 'SCANNER_UNAVAILABLE' };
  }
}

function siteBrandReferencedImages() {
  const raw=db.prepare("SELECT value FROM settings WHERE key='siteBrandWorkspace'").get()?.value;
  return brandImageReferences(raw?JSON.parse(raw):null);
}

export function enforceUploadQuota(userId, incomingSize) {
  const referenced=siteBrandReferencedImages();
  const rows=db.prepare(`SELECT kind,url,size FROM uploads WHERE owner_user_id=? AND attached_product_id IS NULL AND deleted_at IS NULL`).all(userId);
  const unreferenced=rows.filter(row=>row.kind!=='image'||!referenced.has(row.url));
  const pending={count:unreferenced.length,bytes:unreferenced.reduce((sum,row)=>sum+row.size,0)};
  const total = db.prepare(`
    SELECT COALESCE(SUM(size), 0) bytes FROM uploads
    WHERE owner_user_id = ? AND deleted_at IS NULL
  `).get(userId);
  if (pending.count >= MAX_PENDING_UPLOADS) throw new Error('PENDING_UPLOAD_COUNT_EXCEEDED');
  if (pending.bytes + incomingSize > MAX_PENDING_BYTES) throw new Error('PENDING_UPLOAD_BYTES_EXCEEDED');
  if (total.bytes + incomingSize > MAX_USER_STORAGE_BYTES) throw new Error('USER_STORAGE_EXCEEDED');
}

export function registerUpload(record) {
  return db.transaction(() => {
    enforceUploadQuota(record.ownerUserId, record.size);
    try {
      return db.prepare(`INSERT INTO uploads
        (owner_user_id, url, kind, original_name, size, stored_name, content_sha256,
         mime_type, status, expires_at, deleted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
      ).run(record.ownerUserId, record.url, record.kind, record.originalName, record.size,
        record.storedName, record.contentSha256, record.mimeType, record.status, record.expiresAt);
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        const duplicate = new Error('DUPLICATE_CONTENT');
        duplicate.code = 'DUPLICATE_CONTENT';
        throw duplicate;
      }
      throw error;
    }
  }).immediate();
}

export function storedPath(kind, storedName) {
  const roots = uploadRoots();
  const root = kind === 'image' ? roots.publicRoot : roots.privateRoot;
  const target = path.resolve(root, path.basename(storedName));
  if (path.dirname(target) !== root) throw new Error('INVALID_STORED_PATH');
  return target;
}

export function cleanupExpiredUploads(now = Date.now()) {
  const referencedImages = siteBrandReferencedImages();
  const expired = db.prepare(`
    SELECT id, kind, stored_name, url FROM uploads
    WHERE attached_product_id IS NULL AND deleted_at IS NULL
      AND expires_at IS NOT NULL AND expires_at <= ?
  `).all(now);
  let removed = 0;
  for (const upload of expired) {
    if (upload.kind === 'image' && referencedImages.has(upload.url)) continue;
    try {
      if (upload.stored_name) fs.rmSync(storedPath(upload.kind, upload.stored_name), { force: true });
      const result = db.prepare(`
        UPDATE uploads SET deleted_at = ?, status = 'deleted'
        WHERE id = ? AND attached_product_id IS NULL AND deleted_at IS NULL
      `).run(now, upload.id);
      removed += result.changes;
    } catch {}
  }
  return removed;
}

export function cleanupExpiredPostAttachments(now = Date.now()) {
  const expired = db.prepare(`SELECT id,stored_name FROM post_attachments WHERE post_id IS NULL AND expires_at IS NOT NULL AND expires_at<=?`).all(now);
  let removed = 0;
  for (const item of expired) {
    try {
      fs.rmSync(storedPostAttachmentPath(item.stored_name), { force: true });
      removed += db.prepare('DELETE FROM post_attachments WHERE id=? AND post_id IS NULL AND expires_at<=?').run(item.id, now).changes;
    } catch {}
  }
  return removed;
}

export function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
