export const version = 7;
export const name = 'admin-program-reuse';
export const checksum = '466afa377b555bcb836cd284c6c05a2f2275572284fbc3436d6b3769890bb9fa';

export function up(db) {
  db.exec(`
    DROP INDEX IF EXISTS idx_uploads_owner_content;
    CREATE UNIQUE INDEX idx_uploads_owner_pending_content
      ON uploads(owner_user_id, kind, content_sha256)
      WHERE deleted_at IS NULL AND attached_product_id IS NULL AND content_sha256 IS NOT NULL;
  `);
}