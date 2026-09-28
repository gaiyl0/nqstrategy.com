export const version = 2;
export const name = 'relational-integrity';
export const checksum = '5f7a54640dcd1b7650a1d3655c6c965ee8d2088e27f1abcc76d4456464b8aa6d';
export const requiresForeignKeysOff = true;

export function up(db) {
  const orphanComments=db.prepare('SELECT COUNT(*) count FROM comments c LEFT JOIN posts p ON p.id=c.post_id WHERE p.id IS NULL').get().count;
  if(orphanComments)throw new Error(`ORPHAN_COMMENTS_FOUND:${orphanComments}`);
  const orphanOrders=db.prepare('SELECT COUNT(*) count FROM orders o LEFT JOIN products p ON p.id=o.product_id WHERE p.id IS NULL').get().count;
  if(orphanOrders)throw new Error(`ORPHAN_ORDERS_FOUND:${orphanOrders}`);

  db.exec(`
    CREATE TABLE comments_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      author TEXT NOT NULL,
      author_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
      content TEXT NOT NULL,
      is_pinned BOOLEAN DEFAULT 0,
      moderation_status TEXT NOT NULL DEFAULT 'visible' CHECK (moderation_status IN ('visible','hidden')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO comments_v2(id,post_id,author,author_user_id,content,is_pinned,moderation_status,created_at)
      SELECT id,post_id,author,author_user_id,content,is_pinned,moderation_status,created_at FROM comments;
    DROP TABLE comments;
    ALTER TABLE comments_v2 RENAME TO comments;
    CREATE INDEX idx_comments_author_user_id ON comments(author_user_id);

    CREATE TABLE orders_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      buyer_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      price REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      tx_hash TEXT,
      payment_verified INTEGER NOT NULL DEFAULT 0 CHECK (payment_verified IN (0,1)),
      verified_at DATETIME,
      settled_at DATETIME,
      decision_key TEXT,
      decision_at DATETIME,
      decision_by_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO orders_v2(id,username,buyer_user_id,product_id,price,status,tx_hash,payment_verified,verified_at,settled_at,decision_key,decision_at,decision_by_user_id,created_at)
      SELECT id,username,buyer_user_id,product_id,price,status,tx_hash,payment_verified,verified_at,settled_at,decision_key,decision_at,decision_by_user_id,created_at FROM orders;
    DROP TABLE orders;
    ALTER TABLE orders_v2 RENAME TO orders;
    CREATE UNIQUE INDEX idx_orders_unique_tx_hash ON orders(tx_hash)
      WHERE tx_hash IS NOT NULL AND tx_hash<>'' AND tx_hash<>'FREE_LICENSE';
    CREATE UNIQUE INDEX idx_orders_one_per_user_product_id ON orders(buyer_user_id,product_id)
      WHERE buyer_user_id IS NOT NULL;
    CREATE UNIQUE INDEX idx_orders_decision_key ON orders(decision_key)
      WHERE decision_key IS NOT NULL;
  `);
}
