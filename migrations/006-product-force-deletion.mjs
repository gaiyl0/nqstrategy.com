export const version = 6;
export const name = 'product-force-deletion';
export const checksum = 'fa3e0a323ae9afebf3f9dab381a5792e0c3214e7d0d93d75c0557dd8d64fe7be';

export function up(db) {
  db.exec(`
    ALTER TABLE products ADD COLUMN deleted_at INTEGER;
    ALTER TABLE products ADD COLUMN deleted_by_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT;
    ALTER TABLE products ADD COLUMN deletion_reason TEXT;
    CREATE INDEX idx_products_visible_created ON products(deleted_at, moderation_status, status, created_at DESC);
  `);
}
