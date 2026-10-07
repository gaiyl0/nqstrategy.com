export const version = 12;
export const name = 'point-assets';
export const checksum = '121b017ea9754693b1940c2932f5603362d07fefa8c28d8eb7b033500ce0e0c5';

export function up(db) {
  db.exec(`
    CREATE TABLE point_asset_accounts (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
      funded_units INTEGER NOT NULL DEFAULT 0 CHECK (funded_units >= 0),
      bonus_units INTEGER NOT NULL DEFAULT 0 CHECK (bonus_units >= 0),
      withdrawable_units INTEGER NOT NULL DEFAULT 0 CHECK (withdrawable_units >= 0 AND withdrawable_units <= funded_units),
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE point_asset_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      funded_delta INTEGER NOT NULL DEFAULT 0,
      bonus_delta INTEGER NOT NULL DEFAULT 0,
      withdrawable_delta INTEGER NOT NULL DEFAULT 0,
      funded_after INTEGER NOT NULL CHECK (funded_after >= 0),
      bonus_after INTEGER NOT NULL CHECK (bonus_after >= 0),
      withdrawable_after INTEGER NOT NULL CHECK (withdrawable_after >= 0 AND withdrawable_after <= funded_after),
      business_key TEXT NOT NULL UNIQUE,
      reason TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      CHECK (funded_delta <> 0 OR bonus_delta <> 0 OR withdrawable_delta <> 0)
    );
    CREATE INDEX idx_point_asset_tx_user ON point_asset_transactions(user_id,id DESC);
    CREATE TABLE point_asset_reward_sources (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      task_code TEXT NOT NULL REFERENCES point_tasks(code) ON DELETE RESTRICT,
      source_id INTEGER NOT NULL,
      transaction_id INTEGER NOT NULL UNIQUE REFERENCES point_asset_transactions(id) ON DELETE RESTRICT,
      PRIMARY KEY (user_id,task_code,source_id)
    );
    CREATE TABLE point_asset_sales (
      order_id INTEGER PRIMARY KEY REFERENCES orders(id) ON DELETE RESTRICT,
      buyer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      developer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      price_units INTEGER NOT NULL CHECK (price_units > 0),
      funded_spent_units INTEGER NOT NULL CHECK (funded_spent_units >= 0),
      bonus_spent_units INTEGER NOT NULL CHECK (bonus_spent_units >= 0),
      creator_funded_units INTEGER NOT NULL CHECK (creator_funded_units >= 0),
      creator_bonus_units INTEGER NOT NULL CHECK (creator_bonus_units >= 0),
      platform_funded_units INTEGER NOT NULL CHECK (platform_funded_units >= 0),
      platform_bonus_units INTEGER NOT NULL CHECK (platform_bonus_units >= 0),
      created_at INTEGER NOT NULL,
      CHECK (funded_spent_units + bonus_spent_units = price_units),
      CHECK (creator_funded_units + platform_funded_units = funded_spent_units),
      CHECK (creator_bonus_units + platform_bonus_units = bonus_spent_units)
    );
    CREATE TABLE point_asset_withdrawals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      units INTEGER NOT NULL CHECK (units >= 10000),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','rejected')),
      applicant_note TEXT NOT NULL DEFAULT '' CHECK (length(applicant_note) <= 200),
      reviewer_note TEXT NOT NULL DEFAULT '' CHECK (length(reviewer_note) <= 500),
      reviewer_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
      reviewed_at INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX idx_point_asset_withdrawal_pending ON point_asset_withdrawals(user_id) WHERE status='pending';
    CREATE TABLE point_recharge_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      points_units INTEGER NOT NULL CHECK (points_units BETWEEN 100 AND 100000000),
      cny_fen INTEGER NOT NULL CHECK (cny_fen > 0),
      cny_fen_per_usd INTEGER NOT NULL CHECK (cny_fen_per_usd BETWEEN 100 AND 2000),
      provider TEXT NOT NULL CHECK (provider IN ('wechat','alipay')),
      request_key TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','expired')),
      provider_trade_no TEXT UNIQUE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      paid_at INTEGER
    );
  `);
  const now=Date.now();
  const rows=db.prepare(`SELECT u.id,u.role,u.balance,COALESCE(p.balance,0) old_points
    FROM users u LEFT JOIN point_accounts p ON p.user_id=u.id
    WHERE u.balance>0 OR COALESCE(p.balance,0)>0`).all();
  const insertAccount=db.prepare('INSERT INTO point_asset_accounts(user_id,funded_units,bonus_units,withdrawable_units,updated_at) VALUES(?,?,?,?,?)');
  const insertOpening=db.prepare(`INSERT INTO point_asset_transactions(user_id,funded_delta,bonus_delta,withdrawable_delta,funded_after,bonus_after,withdrawable_after,business_key,reason,metadata,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`);
  for(const row of rows){
    const funded=Math.round(Number(row.balance)*100);
    const bonus=Number(row.old_points)*100;
    const withdrawable=['developer','admin'].includes(row.role)?funded:0;
    insertAccount.run(row.id,funded,bonus,withdrawable,now);
    insertOpening.run(row.id,funded,bonus,withdrawable,funded,bonus,withdrawable,`migration:12:${row.id}`,'legacy_balance_migration',JSON.stringify({legacyWalletUsd:row.balance,legacyRewardPoints:row.old_points}),now);
  }
}
