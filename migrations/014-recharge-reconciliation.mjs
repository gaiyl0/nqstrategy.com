export const version = 14;
export const name = 'recharge-reconciliation';
export const checksum = '3e9eccd6ba1807937192661659b9f21525a4a5ba88296996fc941d20fc238b8d';

export function up(db) {
  db.exec(`
    CREATE TABLE point_recharge_checks (
      order_id INTEGER PRIMARY KEY REFERENCES point_recharge_orders(id) ON DELETE RESTRICT,
      state TEXT NOT NULL DEFAULT 'waiting' CHECK(state IN ('waiting','credited','closed','error','review')),
      attempts INTEGER NOT NULL DEFAULT 0,
      failures INTEGER NOT NULL DEFAULT 0,
      last_checked_at INTEGER,
      next_check_at INTEGER NOT NULL,
      error_code TEXT,
      lease_token TEXT,
      lease_until INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX idx_recharge_checks_due ON point_recharge_checks(state,next_check_at,lease_until);
    CREATE TABLE point_recharge_worker_state (
      id INTEGER PRIMARY KEY CHECK(id=1),
      last_started_at INTEGER, last_finished_at INTEGER,
      processed INTEGER NOT NULL DEFAULT 0, errors INTEGER NOT NULL DEFAULT 0
    );
  `);
}
