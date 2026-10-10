export const version = 15;
export const name = 'recharge-refunds';
export const checksum = '3968fbe652c58f2ac976dba862ebd49e6391a1ca99ee92c3ba3a1d967a667a7e';
export function up(db) {
  db.exec(`CREATE TABLE point_recharge_refunds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES point_recharge_orders(id) ON DELETE RESTRICT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    units INTEGER NOT NULL CHECK(units>0),
    request_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','unknown','paid','rejected')),
    reason TEXT NOT NULL, reviewer_id INTEGER REFERENCES users(id), reviewer_note TEXT,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, paid_at INTEGER,
    attempts INTEGER NOT NULL DEFAULT 0, error_code TEXT,
    lease_token TEXT, lease_until INTEGER NOT NULL DEFAULT 0,
    next_check_at INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX idx_recharge_refunds_user ON point_recharge_refunds(user_id,id);
  CREATE INDEX idx_recharge_refunds_due ON point_recharge_refunds(status,next_check_at,lease_until);`);
}
