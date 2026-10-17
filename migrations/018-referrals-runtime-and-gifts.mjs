export const version = 18;
export const name = 'referrals-runtime-and-gifts';
export const checksum = 'c92760025c51544df3e2f0ee20879117c6cf88a49a0feed1feb5884c233d562c';
export function up(db) {
  db.exec(`
    CREATE TABLE system_owners (
      user_id INTEGER PRIMARY KEY REFERENCES users(id), created_at INTEGER NOT NULL
    );
    INSERT INTO system_owners(user_id,created_at)
      SELECT id,CAST(strftime('%s','now') AS INTEGER)*1000 FROM users
      WHERE role='admin' AND deleted_at IS NULL ORDER BY id LIMIT 1;
    CREATE TABLE referral_codes (
      user_id INTEGER PRIMARY KEY REFERENCES users(id), code TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL
    );
    CREATE TABLE referral_signals (
      user_id INTEGER PRIMARY KEY REFERENCES users(id), device_hash TEXT, source_hash TEXT,
      email_hash TEXT NOT NULL, created_at INTEGER NOT NULL
    );
    CREATE INDEX referral_signal_device ON referral_signals(device_hash);
    CREATE INDEX referral_signal_source ON referral_signals(source_hash,created_at);
    CREATE TABLE referral_invitations (
      id INTEGER PRIMARY KEY, inviter_id INTEGER NOT NULL REFERENCES users(id),
      invitee_id INTEGER NOT NULL UNIQUE REFERENCES users(id), reward_units INTEGER NOT NULL DEFAULT 20000 CHECK(reward_units=20000),
      status TEXT NOT NULL CHECK(status IN ('pending','review','rewarded','rejected')),
      risk_flags TEXT NOT NULL DEFAULT '[]', eligible_at INTEGER NOT NULL, created_at INTEGER NOT NULL,
      reviewed_by INTEGER REFERENCES users(id), reviewed_at INTEGER, review_note TEXT NOT NULL DEFAULT '',
      transaction_id INTEGER UNIQUE REFERENCES point_asset_transactions(id),
      CHECK(inviter_id<>invitee_id)
    );
    CREATE INDEX referral_due ON referral_invitations(status,eligible_at);
    CREATE INDEX referral_inviter ON referral_invitations(inviter_id,created_at);
    CREATE TABLE admin_point_gifts (
      id INTEGER PRIMARY KEY, request_key TEXT NOT NULL UNIQUE, user_id INTEGER NOT NULL REFERENCES users(id),
      admin_id INTEGER NOT NULL REFERENCES users(id), units INTEGER NOT NULL CHECK(units>0 AND units<=100000000),
      reason TEXT NOT NULL, transaction_id INTEGER UNIQUE REFERENCES point_asset_transactions(id), created_at INTEGER NOT NULL
    );
    CREATE TABLE runtime_authorizations (
      id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), product_id INTEGER NOT NULL REFERENCES products(id),
      code_hash TEXT NOT NULL UNIQUE, code_hint TEXT NOT NULL, duration_days INTEGER NOT NULL CHECK(duration_days IN (30,90,365)),
      status TEXT NOT NULL DEFAULT 'issued' CHECK(status IN ('issued','active','revoked')),
      binding_hash TEXT, account_mask TEXT, server_name TEXT, activated_at INTEGER, expires_at INTEGER,
      issued_by INTEGER NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      revoked_at INTEGER, note TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX runtime_owner ON runtime_authorizations(user_id,product_id);
    CREATE TABLE ea_connections (
      id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), product_id INTEGER NOT NULL REFERENCES products(id),
      license_id INTEGER NOT NULL REFERENCES product_licenses(id), token_hash TEXT NOT NULL UNIQUE,
      token_hint TEXT NOT NULL, label TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
      binding_hash TEXT, account_mask TEXT, server_name TEXT, consent_at INTEGER NOT NULL, created_at INTEGER NOT NULL,
      last_seen_at INTEGER, last_sequence INTEGER NOT NULL DEFAULT 0,
      currency TEXT, balance REAL, equity REAL, floating_profit REAL, free_margin REAL,
      positions_count INTEGER, ea_positions_count INTEGER, ea_floating_profit REAL, revoked_at INTEGER
    );
    CREATE INDEX ea_connection_owner ON ea_connections(user_id,created_at);
    CREATE TABLE runtime_authorization_events (
      id INTEGER PRIMARY KEY, authorization_id INTEGER NOT NULL REFERENCES runtime_authorizations(id),
      action TEXT NOT NULL, actor_id INTEGER REFERENCES users(id), note TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL
    );
  `);
}
