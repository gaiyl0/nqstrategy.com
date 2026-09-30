import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createPostSchema } from '../lib/validation.js';

const databasePath = path.resolve('.tmp-post-attachments-test.db');
for (const suffix of ['', '-wal', '-shm']) { try { fs.rmSync(`${databasePath}${suffix}`); } catch {} }
process.env.NEXUS_DB_PATH = databasePath;
const { default: db } = await import('../lib/db.js');
const route = fs.readFileSync(path.resolve('app/api/post-attachments/route.js'), 'utf8');
const postRoute = fs.readFileSync(path.resolve('app/api/posts/route.js'), 'utf8');

assert.equal(createPostSchema.safeParse({ title: 'Valid post', content: 'body', category: 'research' }).data.attachments.length, 0);
assert.equal(createPostSchema.safeParse({ title: 'Valid post', content: 'body', category: 'research', attachments: [1, 2] }).success, true);
assert.equal(createPostSchema.safeParse({ title: 'Valid post', content: 'body', category: 'research', attachments: [1, 1] }).success, false);
assert.equal(createPostSchema.safeParse({ title: 'Valid post', content: 'body', category: 'research', attachments: Array(11).fill(1) }).success, false);

const userId = Number(db.prepare("INSERT INTO users(username,email,role,password) VALUES('asset-author','asset-author@test.invalid','user','test-hash')").run().lastInsertRowid);
const postId = Number(db.prepare("INSERT INTO posts(title,content,author,author_user_id,category) VALUES('Image report','![chart](/api/post-attachments?id=1)','asset-author',?,'research')").run(userId).lastInsertRowid);
const insert = db.prepare(`INSERT INTO post_attachments(owner_user_id,post_id,kind,original_name,stored_name,content_sha256,mime_type,size,status,created_at,expires_at)
  VALUES(?,?,'image','chart.png',?,'${'a'.repeat(64)}','image/png',512,'content_validated',?,NULL)`);
const storedName = `${Date.now()}_abcdef0123456789.png`;
const attachmentId = Number(insert.run(userId, postId, storedName, Date.now()).lastInsertRowid);
assert.equal(db.prepare('SELECT post_id FROM post_attachments WHERE id=?').get(attachmentId).post_id, postId);
assert.equal(db.prepare('SELECT MAX(version) version FROM schema_migrations').get().version, 5);
assert.match(route, /validateAndNormalizeImage/, 'images must be decoded and normalized before storage');
assert.match(route, /malwareScan/, 'uploads must pass the configured malware scan');
assert.match(route, /storedPostAttachmentPath/, 'uploaded assets must stay outside public static folders');
assert.match(route, /a\.owner_user_id=\? AND \(a\.expires_at IS NULL OR a\.expires_at>\?\).*p\.moderation_status='visible'/s, 'unpublished files must remain private to their owner and expired assets must be inaccessible');
assert.match(postRoute, /POST_ATTACHMENT_CLAIM_FAILED/, 'post and attachment ownership must be claimed together');
assert.match(postRoute, /正文中的图片必须属于本次提交的附件/, 'inline image references must be owned and submitted with the post');
assert.match(postRoute, /UPDATE post_attachments SET post_id = NULL, expires_at = \? WHERE post_id = \?/, 'deleting a post must detach files and schedule private cleanup');
assert.match(route, /a\.expires_at IS NULL OR a\.expires_at>\?/, 'expired or deleted-post files must no longer be readable by their owner');

db.transaction(() => {
  db.prepare('UPDATE post_attachments SET post_id=NULL,expires_at=? WHERE post_id=?').run(Date.now(), postId);
  db.prepare('DELETE FROM posts WHERE id=?').run(postId);
})();
const detached = db.prepare('SELECT post_id,expires_at FROM post_attachments WHERE id=?').get(attachmentId);
assert.equal(detached.post_id, null);
assert.ok(detached.expires_at <= Date.now(), 'deleted-post assets must expire immediately');

db.close();
for (const suffix of ['', '-wal', '-shm']) { try { fs.rmSync(`${databasePath}${suffix}`); } catch {} }
console.log('Post attachment tests passed: schema limits, migration, ownership, private storage and image validation');
