export const version = 13;
export const name = 'paypal-point-recharge';
export const checksum = 'b8af2db1efad540a6d9c80e3721f3b342cc72ed17609ebe8b685b89f55e362c0';

export function up(db) {
  db.exec(`
    CREATE TABLE paypal_point_recharge_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      mode TEXT NOT NULL CHECK (mode IN ('sandbox','live')),
      points_units INTEGER NOT NULL CHECK (points_units BETWEEN 100 AND 100000000),
      usd_cents INTEGER NOT NULL CHECK (usd_cents = points_units),
      request_key TEXT NOT NULL UNIQUE,
      paypal_order_id TEXT UNIQUE,
      capture_id TEXT UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed')),
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      paid_at INTEGER
    );
    CREATE INDEX idx_paypal_point_recharge_user ON paypal_point_recharge_orders(user_id,created_at DESC);
  `);
}
