export const version = 10;
export const name = 'points-and-tasks';
export const checksum = 'b9c638d2592436ea9ec1cac96b15d37a5026655c1dbc19eb7e7ba59ec8c46145';

export function up(db) {
  db.exec(`
    ALTER TABLE products ADD COLUMN points_price INTEGER CHECK (points_price BETWEEN 1 AND 1000000);

    CREATE TABLE point_accounts (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
      balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE point_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      delta INTEGER NOT NULL CHECK (delta <> 0),
      balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
      business_key TEXT NOT NULL UNIQUE CHECK (length(business_key) BETWEEN 8 AND 180),
      reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 80),
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL
    );
    CREATE INDEX idx_point_transactions_user_time ON point_transactions(user_id,created_at DESC,id DESC);

    CREATE TABLE point_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE CHECK (length(code) BETWEEN 3 AND 50),
      title TEXT NOT NULL CHECK (length(title) BETWEEN 2 AND 100),
      description TEXT NOT NULL DEFAULT '',
      reward_points INTEGER NOT NULL CHECK (reward_points BETWEEN 0 AND 1000000),
      cadence TEXT NOT NULL CHECK (cadence IN ('daily','once')),
      review_mode TEXT NOT NULL CHECK (review_mode IN ('automatic','manual')),
      target_url TEXT NOT NULL DEFAULT '',
      proof_label TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
      is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0,1)),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE point_reward_sources (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      task_code TEXT NOT NULL REFERENCES point_tasks(code) ON DELETE RESTRICT,
      source_id INTEGER NOT NULL,
      transaction_id INTEGER NOT NULL UNIQUE REFERENCES point_transactions(id) ON DELETE RESTRICT,
      PRIMARY KEY (user_id,task_code,source_id)
    );
    CREATE TABLE point_task_claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      task_id INTEGER NOT NULL REFERENCES point_tasks(id) ON DELETE RESTRICT,
      contact_email TEXT NOT NULL DEFAULT '',
      customer_id TEXT NOT NULL DEFAULT '',
      proof_text TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
      reviewer_note TEXT NOT NULL DEFAULT '',
      reviewed_by_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
      reviewed_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE (user_id,task_id)
    );
    CREATE INDEX idx_point_task_claims_status_time ON point_task_claims(status,created_at DESC);

    CREATE TABLE point_redemptions (
      order_id INTEGER PRIMARY KEY REFERENCES orders(id) ON DELETE RESTRICT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      points_spent INTEGER NOT NULL CHECK (points_spent > 0),
      transaction_id INTEGER NOT NULL UNIQUE REFERENCES point_transactions(id) ON DELETE RESTRICT,
      created_at INTEGER NOT NULL,
      UNIQUE (user_id,product_id)
    );
  `);
  const now=Date.now();
  const insert=db.prepare(`INSERT INTO point_tasks(code,title,description,reward_points,cadence,review_mode,target_url,proof_label,is_system,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,1,?,?)`);
  for (const task of [
    ['daily_checkin','每日签到','每天签到一次',5,'daily','automatic','',''],
    ['daily_post','每日发帖','发布有价值的论坛帖子，每天最多奖励一次',10,'daily','automatic','',''],
    ['daily_comment','每日回帖','参与论坛讨论，每天最多奖励一次',3,'daily','automatic','',''],
    ['daily_rating','每日策略评分','评价不同的已获得策略，每天最多奖励一次',3,'daily','automatic','',''],
    ['tmgm_deposit','注册 TMGM 并完成入金','提交注册邮箱及客户 ID，由管理员核对实际入金后发放',100,'once','manual','','注册邮箱与客户 ID'],
    ['follow_x','关注 X 账号','提交 X 账号，由管理员核对后发放',10,'once','manual','','X 账号'],
    ['join_telegram','加入 Telegram 群组','提交 Telegram 用户名，由管理员核对后发放',10,'once','manual','','Telegram 用户名'],
  ]) insert.run(...task,now,now);
}
