import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import db from '../lib/db.js';
import {
  classifyUpload, cleanupExpiredUploads, enforceUploadQuota, sha256, storedPath,
  validateAndNormalizeImage, validateCompiledEA,
} from '../lib/upload-security.js';

assert.match(path.basename(process.cwd()), /^\.tmp-upload-security-/);
db.prepare(`INSERT INTO users (username,email,password,role) VALUES ('dev','dev@example.test','x','developer')`).run();

const png = await sharp({ create: { width: 16, height: 16, channels: 4, background: '#22d3ee' } }).png().toBuffer();
const normalized = await validateAndNormalizeImage(png, 'png');
assert.equal((await sharp(normalized).metadata()).format, 'png');
await assert.rejects(() => validateAndNormalizeImage(png, 'jpeg'), /IMAGE_CONTENT_MISMATCH/);
await assert.rejects(() => validateAndNormalizeImage(Buffer.from('<script>alert(1)</script>'), 'png'));

assert.equal(classifyUpload('.zip'), null);
assert.equal(classifyUpload('.mq5'), null);
assert.equal(classifyUpload('.EX5').kind, 'ea');
const ex5 = Buffer.concat([Buffer.from('EX5\x02', 'binary'), Buffer.alloc(128, 7)]);
assert.equal(validateCompiledEA(ex5, 'EX5'), ex5);
assert.throws(() => validateCompiledEA(Buffer.concat([Buffer.from('MZ'), Buffer.alloc(128)]), 'EX5'), /EA_CONTENT_MISMATCH/);
assert.throws(() => validateCompiledEA(Buffer.concat([Buffer.from('PK\x03\x04', 'binary'), Buffer.alloc(128)]), 'EX5'), /EA_CONTENT_MISMATCH/);

const insert = db.prepare(`INSERT INTO uploads
  (owner_user_id,url,kind,original_name,size,stored_name,content_sha256,mime_type,status,expires_at)
  VALUES (1,?,'image','x.png',1,?,?,'image/png','content_validated',?)`);
for (let index = 0; index < 10; index += 1) {
  insert.run(`/uploads/quota-${index}.png`, `quota-${index}.png`, sha256(Buffer.from(String(index))), Date.now() + 60_000);
}
assert.throws(() => enforceUploadQuota(1, 1), /PENDING_UPLOAD_COUNT_EXCEEDED/);

db.prepare('DELETE FROM uploads').run();
const expiredName = 'expired.png';
const expiredPath = storedPath('image', expiredName);
fs.mkdirSync(path.dirname(expiredPath), { recursive: true });
fs.writeFileSync(expiredPath, normalized);
insert.run('/uploads/expired.png', expiredName, sha256(normalized), Date.now() - 1);
assert.equal(cleanupExpiredUploads(), 1);
assert.equal(fs.existsSync(expiredPath), false);
assert.equal(db.prepare('SELECT status FROM uploads WHERE stored_name = ?').get(expiredName).status, 'deleted');

console.log(JSON.stringify({ passed: true, assertions: 16 }));
