export const version = 4;
export const name = 'post-attachments';
export const checksum = '6761507ccbf018b165b433a6bd16f2f1921d0c3e51e3af35c9873ca2668122c8';

export function up(db) {
  db.exec(`
    CREATE TABLE post_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('image','file')),
      original_name TEXT NOT NULL CHECK (length(original_name) BETWEEN 1 AND 255),
      stored_name TEXT NOT NULL UNIQUE CHECK (stored_name GLOB '[0-9]*_[a-f0-9]*.*'),
      content_sha256 TEXT NOT NULL CHECK (length(content_sha256)=64),
      mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png','image/jpeg','image/webp','application/pdf','text/plain','text/csv')),
      size INTEGER NOT NULL CHECK (size BETWEEN 1 AND 10485760),
      status TEXT NOT NULL CHECK (status IN ('clean','content_validated')),
      created_at INTEGER NOT NULL,
      expires_at INTEGER
    );
    CREATE INDEX idx_post_attachments_owner_pending ON post_attachments(owner_user_id, expires_at) WHERE post_id IS NULL;
    CREATE INDEX idx_post_attachments_post ON post_attachments(post_id) WHERE post_id IS NOT NULL;
  `);
}
