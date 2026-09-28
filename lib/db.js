import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';

const databasePath = process.env.NEXUS_DB_PATH
  ? path.resolve(process.env.NEXUS_DB_PATH)
  : path.join(process.cwd(), 'data.db');
const db = new Database(databasePath);
let auditMaintenanceDepth = 0;
let walletMaintenanceDepth = 0;

db.function('audit_maintenance_allowed', () => auditMaintenanceDepth > 0 ? 1 : 0);
db.function('wallet_maintenance_allowed', () => walletMaintenanceDepth > 0 ? 1 : 0);

export function withAuditMaintenance(callback) {
  auditMaintenanceDepth += 1;
  try {
    return callback();
  } finally {
    auditMaintenanceDepth -= 1;
  }
}

export function withWalletMaintenance(callback) {
  walletMaintenanceDepth += 1;
  try {
    return callback();
  } finally {
    walletMaintenanceDepth -= 1;
  }
}

// 开启 SQLite WAL 预写日志模式，提高高频读写稳定性
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY, 
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    username TEXT UNIQUE NOT NULL, 
    email TEXT UNIQUE NOT NULL,
    role TEXT DEFAULT 'user', 
    email_verified BOOLEAN DEFAULT 0, 
    join_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    password TEXT NOT NULL, 
    avatar_url TEXT, 
    balance REAL DEFAULT 0,
    session_version INTEGER NOT NULL DEFAULT 1,
    password_reset_required INTEGER NOT NULL DEFAULT 0 CHECK (password_reset_required IN (0, 1)),
    deleted_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS verification_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT COLLATE NOCASE NOT NULL,
    purpose TEXT NOT NULL CHECK (purpose IN ('register', 'reset')),
    code_digest TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    max_attempts INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 20),
    consumed_at INTEGER,
    created_at INTEGER NOT NULL,
    UNIQUE(email, purpose)
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    title TEXT NOT NULL, 
    author TEXT NOT NULL, 
    author_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    description TEXT, 
    logo_url TEXT, 
    file_url TEXT, 
    price INTEGER DEFAULT 0, 
    win_rate TEXT, 
    drawdown TEXT, 
    pairs TEXT, 
    ea_type TEXT, 
    trial_enabled INTEGER NOT NULL DEFAULT 0 CHECK (trial_enabled IN (0,1)),
    trial_days INTEGER NOT NULL DEFAULT 7 CHECK (trial_days BETWEEN 1 AND 30),
    status TEXT DEFAULT 'pending', 
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    title TEXT NOT NULL, 
    content TEXT NOT NULL,
    author TEXT NOT NULL, 
    author_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    category TEXT NOT NULL, 
    views INTEGER DEFAULT 0, 
    is_pinned BOOLEAN DEFAULT 0, 
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    post_id INTEGER NOT NULL, 
    author TEXT NOT NULL, 
    author_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    content TEXT NOT NULL, 
    is_pinned BOOLEAN DEFAULT 0, 
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    username TEXT NOT NULL, 
    buyer_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    product_id INTEGER NOT NULL, 
    price REAL DEFAULT 0,
    status TEXT DEFAULT 'pending',
    tx_hash TEXT,
    payment_verified INTEGER NOT NULL DEFAULT 0 CHECK (payment_verified IN (0, 1)),
    verified_at DATETIME,
    settled_at DATETIME,
    decision_key TEXT,
    decision_at DATETIME,
    decision_by_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS withdrawals (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    username TEXT NOT NULL, 
    user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    amount REAL NOT NULL,
    crypto_address TEXT NOT NULL, 
    status TEXT DEFAULT 'pending', 
    decision_key TEXT,
    decision_at DATETIME,
    decision_by_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_user_id INTEGER NOT NULL,
    url TEXT UNIQUE NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('image', 'ea')),
    original_name TEXT,
    size INTEGER NOT NULL,
    attached_product_id INTEGER,
    stored_name TEXT,
    content_sha256 TEXT,
    mime_type TEXT,
    status TEXT NOT NULL DEFAULT 'content_validated',
    expires_at INTEGER,
    deleted_at INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (attached_product_id) REFERENCES products(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS strategy_metrics (
    product_id INTEGER PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
    initial_deposit REAL NOT NULL CHECK (initial_deposit > 0),
    net_profit REAL NOT NULL,
    profit_factor REAL NOT NULL CHECK (profit_factor >= 0),
    sharpe_ratio REAL NOT NULL,
    max_drawdown_percent REAL NOT NULL CHECK (max_drawdown_percent BETWEEN 0 AND 100),
    recovery_factor REAL NOT NULL,
    win_rate_percent REAL NOT NULL CHECK (win_rate_percent BETWEEN 0 AND 100),
    total_trades INTEGER NOT NULL CHECK (total_trades >= 1),
    equity_curve_json TEXT NOT NULL,
    drawdown_curve_json TEXT NOT NULL,
    monthly_returns_json TEXT NOT NULL,
    submitted_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    reviewed_at INTEGER,
    reviewed_by_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT
  );

  CREATE TABLE IF NOT EXISTS strategy_evidence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    evidence_type TEXT NOT NULL CHECK (evidence_type IN ('settings', 'statistics', 'chart', 'analysis')),
    original_name TEXT NOT NULL,
    original_stored_name TEXT NOT NULL UNIQUE,
    preview_stored_name TEXT NOT NULL UNIQUE,
    content_sha256 TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL CHECK (size > 0),
    extraction_status TEXT NOT NULL CHECK (extraction_status IN ('completed', 'manual_review', 'failed')),
    extraction_json TEXT,
    extraction_confidence REAL CHECK (extraction_confidence IS NULL OR extraction_confidence BETWEEN 0 AND 1),
    review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    uploaded_at INTEGER NOT NULL,
    reviewed_at INTEGER,
    reviewed_by_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    UNIQUE(owner_user_id, content_sha256, evidence_type)
  );

  CREATE TABLE IF NOT EXISTS strategy_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER UNIQUE REFERENCES products(id) ON DELETE CASCADE,
    owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL UNIQUE,
    content_sha256 TEXT NOT NULL,
    size INTEGER NOT NULL CHECK (size > 0),
    parser_version INTEGER NOT NULL DEFAULT 1,
    extracted_json TEXT NOT NULL,
    uploaded_at INTEGER NOT NULL,
    UNIQUE(owner_user_id, content_sha256)
  );

  CREATE TABLE IF NOT EXISTS strategy_verifications (
    product_id INTEGER PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
    level TEXT NOT NULL CHECK (level IN ('unverified','screenshot_reviewed','report_verified','reproducible_backtest','platform_rerun','live_verified')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
    evidence_json TEXT NOT NULL DEFAULT '{}',
    verified_at INTEGER,
    verified_by_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    expires_at INTEGER,
    last_checked_at INTEGER,
    revoked_at INTEGER,
    revocation_reason TEXT
  );

  CREATE TABLE IF NOT EXISTS strategy_verification_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    previous_level TEXT NOT NULL,
    new_level TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('automatic','approved','revoked','downgraded')),
    evidence_json TEXT NOT NULL DEFAULT '{}',
    reason TEXT,
    actor_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS product_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    version TEXT NOT NULL,
    release_notes TEXT NOT NULL,
    upload_id INTEGER NOT NULL UNIQUE REFERENCES uploads(id) ON DELETE RESTRICT,
    file_url TEXT NOT NULL UNIQUE,
    content_sha256 TEXT NOT NULL,
    upgrade_policy TEXT NOT NULL CHECK (upgrade_policy IN ('all_existing','new_purchases_only')),
    entitlement_cutoff INTEGER,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published','rejected','retired')),
    is_current INTEGER NOT NULL DEFAULT 0 CHECK (is_current IN (0,1)),
    submitted_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reviewed_by_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    rejection_reason TEXT,
    created_at INTEGER NOT NULL,
    reviewed_at INTEGER,
    released_at INTEGER,
    UNIQUE(product_id, version)
  );

  CREATE TABLE IF NOT EXISTS product_version_downloads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version_id INTEGER NOT NULL REFERENCES product_versions(id) ON DELETE RESTRICT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    order_id INTEGER REFERENCES orders(id) ON DELETE RESTRICT,
    downloaded_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS product_licenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    version_id INTEGER REFERENCES product_versions(id) ON DELETE RESTRICT,
    source_order_id INTEGER UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
    license_type TEXT NOT NULL CHECK (license_type IN ('purchase','free','trial')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
    starts_at INTEGER NOT NULL,
    expires_at INTEGER,
    token_version INTEGER NOT NULL DEFAULT 1,
    revoked_at INTEGER,
    revoked_by_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    revocation_reason TEXT,
    created_at INTEGER NOT NULL,
    CHECK ((license_type='trial' AND expires_at IS NOT NULL AND version_id IS NOT NULL AND source_order_id IS NULL)
      OR (license_type IN ('purchase','free') AND expires_at IS NULL AND source_order_id IS NOT NULL))
  );

  CREATE TABLE IF NOT EXISTS license_bindings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    license_id INTEGER NOT NULL REFERENCES product_licenses(id) ON DELETE RESTRICT,
    binding_type TEXT NOT NULL CHECK (binding_type IN ('trading_account','device')),
    binding_hash TEXT NOT NULL,
    display_mask TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','replaced')),
    bound_at INTEGER NOT NULL,
    replaced_at INTEGER,
    UNIQUE(license_id,binding_type,binding_hash)
  );

  CREATE TABLE IF NOT EXISTS license_binding_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    license_id INTEGER NOT NULL REFERENCES product_licenses(id) ON DELETE RESTRICT,
    binding_type TEXT NOT NULL,
    previous_binding_id INTEGER REFERENCES license_bindings(id) ON DELETE RESTRICT,
    new_binding_id INTEGER NOT NULL REFERENCES license_bindings(id) ON DELETE RESTRICT,
    actor_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS product_favorites (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, product_id)
  );

  CREATE TABLE IF NOT EXISTS developer_follows (
    follower_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    developer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (follower_user_id, developer_user_id),
    CHECK (follower_user_id <> developer_user_id)
  );

  CREATE TABLE IF NOT EXISTS product_ratings (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review_text TEXT NOT NULL DEFAULT '' CHECK (length(review_text) <= 1000),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, product_id)
  );

  CREATE TABLE IF NOT EXISTS rate_limit_buckets (
    bucket_key TEXT PRIMARY KEY,
    scope TEXT NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0,
    reset_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    outcome TEXT NOT NULL CHECK (outcome IN ('success', 'failure', 'blocked')),
    reason_code TEXT NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    actor_role TEXT,
    target_type TEXT,
    target_id TEXT,
    source_hash TEXT NOT NULL,
    user_agent TEXT,
    metadata_json TEXT,
    created_at INTEGER NOT NULL,
    integrity_version INTEGER NOT NULL DEFAULT 1,
    integrity_key_id TEXT NOT NULL DEFAULT '',
    previous_hash TEXT NOT NULL DEFAULT '',
    entry_hash TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS audit_chain_state (
    singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
    last_log_id INTEGER,
    last_entry_hash TEXT NOT NULL,
    integrity_key_id TEXT NOT NULL,
    state_hmac TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_archive_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_log_id INTEGER NOT NULL,
    through_log_id INTEGER NOT NULL UNIQUE,
    row_count INTEGER NOT NULL CHECK (row_count > 0),
    first_previous_hash TEXT NOT NULL,
    last_entry_hash TEXT NOT NULL,
    content_sha256 TEXT NOT NULL,
    manifest_path TEXT NOT NULL UNIQUE,
    integrity_key_id TEXT NOT NULL,
    manifest_hmac TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS wallet_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN
      ('OPENING_BALANCE', 'EA_SALE', 'WITHDRAWAL_HOLD', 'WITHDRAWAL_REFUND', 'ADMIN_ADJUSTMENT')),
    business_key TEXT NOT NULL UNIQUE,
    idempotency_key TEXT UNIQUE,
    amount_minor INTEGER NOT NULL,
    balance_before_minor INTEGER NOT NULL CHECK (balance_before_minor >= 0),
    balance_after_minor INTEGER NOT NULL CHECK (balance_after_minor >= 0),
    order_id INTEGER REFERENCES orders(id) ON DELETE RESTRICT,
    withdrawal_id INTEGER REFERENCES withdrawals(id) ON DELETE RESTRICT,
    actor_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
    metadata_json TEXT,
    previous_hash TEXT NOT NULL,
    integrity_key_id TEXT NOT NULL,
    entry_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_uploads_owner_unattached
    ON uploads(owner_user_id, kind, attached_product_id);

  CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_unique_tx_hash
    ON orders(tx_hash)
    WHERE tx_hash IS NOT NULL AND tx_hash <> '' AND tx_hash <> 'FREE_LICENSE';

  CREATE INDEX IF NOT EXISTS idx_rate_limit_reset_at ON rate_limit_buckets(reset_at);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON audit_logs(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_event_created ON audit_logs(event_type, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_outcome_created ON audit_logs(outcome, created_at DESC);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_logs_request_event ON audit_logs(request_id, event_type);
  CREATE INDEX IF NOT EXISTS idx_audit_archive_batches_through ON audit_archive_batches(through_log_id);
  CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON wallet_transactions(user_id, id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_transactions_order_type
    ON wallet_transactions(order_id, transaction_type) WHERE order_id IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_transactions_withdrawal_type
    ON wallet_transactions(withdrawal_id, transaction_type) WHERE withdrawal_id IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_strategy_metrics_reviewed
    ON strategy_metrics(reviewed_at, product_id);
  CREATE INDEX IF NOT EXISTS idx_strategy_evidence_product
    ON strategy_evidence(product_id, review_status, evidence_type);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_strategy_evidence_product_type
    ON strategy_evidence(product_id, evidence_type) WHERE product_id IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_strategy_reports_owner_product ON strategy_reports(owner_user_id, product_id);
  CREATE INDEX IF NOT EXISTS idx_strategy_verification_history_product ON strategy_verification_history(product_id, id DESC);
  CREATE INDEX IF NOT EXISTS idx_product_favorites_product ON product_favorites(product_id);
  CREATE INDEX IF NOT EXISTS idx_developer_follows_developer ON developer_follows(developer_user_id);
  CREATE INDEX IF NOT EXISTS idx_product_ratings_product ON product_ratings(product_id);
  CREATE INDEX IF NOT EXISTS idx_product_versions_product_status ON product_versions(product_id,status,id DESC);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_product_versions_one_current ON product_versions(product_id) WHERE is_current=1;
  CREATE INDEX IF NOT EXISTS idx_product_version_downloads_version ON product_version_downloads(version_id,downloaded_at DESC);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_product_licenses_one_trial ON product_licenses(user_id,product_id) WHERE license_type='trial';
  CREATE INDEX IF NOT EXISTS idx_product_licenses_user_status ON product_licenses(user_id,status,expires_at);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_license_bindings_one_active ON license_bindings(license_id,binding_type) WHERE status='active';
  CREATE INDEX IF NOT EXISTS idx_license_binding_events_license ON license_binding_events(license_id,id DESC);
`);

db.exec(`
  DROP TRIGGER IF EXISTS product_versions_immutable_identity;
  CREATE TRIGGER IF NOT EXISTS product_versions_immutable_identity
  BEFORE UPDATE OF product_id,version,upload_id,file_url,content_sha256,upgrade_policy,release_notes,submitted_by_user_id,created_at
  ON product_versions
  BEGIN
    SELECT RAISE(ABORT, 'PRODUCT_VERSION_IMMUTABLE');
  END;
`);
db.exec(`
  DROP TRIGGER IF EXISTS product_versions_cutoff_write_once;
  CREATE TRIGGER IF NOT EXISTS product_versions_cutoff_write_once
  BEFORE UPDATE OF entitlement_cutoff ON product_versions
  WHEN OLD.entitlement_cutoff IS NOT NULL OR OLD.status <> 'pending' OR NEW.status <> 'published'
  BEGIN
    SELECT RAISE(ABORT, 'PRODUCT_VERSION_CUTOFF_IMMUTABLE');
  END;
`);

// 自动兼容热补丁字段，防止老数据报错
try { db.exec("ALTER TABLE users ADD COLUMN balance REAL DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE posts ADD COLUMN is_pinned BOOLEAN DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE comments ADD COLUMN is_pinned BOOLEAN DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE orders ADD COLUMN price REAL DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE orders ADD COLUMN status TEXT DEFAULT 'completed'"); } catch (e) {}
try { db.exec("ALTER TABLE orders ADD COLUMN tx_hash TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE orders ADD COLUMN payment_verified INTEGER NOT NULL DEFAULT 0 CHECK (payment_verified IN (0, 1))"); } catch (e) {}
try { db.exec("ALTER TABLE orders ADD COLUMN verified_at DATETIME"); } catch (e) {}
try { db.exec("ALTER TABLE orders ADD COLUMN settled_at DATETIME"); } catch (e) {}
try { db.exec("ALTER TABLE orders ADD COLUMN decision_key TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE orders ADD COLUMN decision_at DATETIME"); } catch (e) {}
try { db.exec("ALTER TABLE orders ADD COLUMN decision_by_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 1"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN password_reset_required INTEGER NOT NULL DEFAULT 0 CHECK (password_reset_required IN (0, 1))"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN deleted_at DATETIME"); } catch (e) {}
try { db.exec("ALTER TABLE products ADD COLUMN author_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT"); } catch (e) {}
try { db.exec("ALTER TABLE products ADD COLUMN trial_enabled INTEGER NOT NULL DEFAULT 0 CHECK (trial_enabled IN (0,1))"); } catch (e) {}
try { db.exec("ALTER TABLE products ADD COLUMN trial_days INTEGER NOT NULL DEFAULT 7 CHECK (trial_days BETWEEN 1 AND 30)"); } catch (e) {}
try { db.exec("ALTER TABLE orders ADD COLUMN buyer_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT"); } catch (e) {}
try { db.exec("ALTER TABLE posts ADD COLUMN author_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT"); } catch (e) {}
try { db.exec("ALTER TABLE comments ADD COLUMN author_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT"); } catch (e) {}
try { db.exec("ALTER TABLE withdrawals ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT"); } catch (e) {}
try { db.exec("ALTER TABLE withdrawals ADD COLUMN decision_key TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE withdrawals ADD COLUMN decision_at DATETIME"); } catch (e) {}
try { db.exec("ALTER TABLE withdrawals ADD COLUMN decision_by_user_id INTEGER REFERENCES users(id) ON DELETE RESTRICT"); } catch (e) {}
try { db.exec("ALTER TABLE audit_logs ADD COLUMN integrity_version INTEGER NOT NULL DEFAULT 1"); } catch (e) {}
try { db.exec("ALTER TABLE audit_logs ADD COLUMN integrity_key_id TEXT NOT NULL DEFAULT ''"); } catch (e) {}
try { db.exec("ALTER TABLE audit_logs ADD COLUMN previous_hash TEXT NOT NULL DEFAULT ''"); } catch (e) {}
try { db.exec("ALTER TABLE audit_logs ADD COLUMN entry_hash TEXT NOT NULL DEFAULT ''"); } catch (e) {}
try { db.exec("ALTER TABLE uploads ADD COLUMN stored_name TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE uploads ADD COLUMN content_sha256 TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE uploads ADD COLUMN mime_type TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE uploads ADD COLUMN status TEXT NOT NULL DEFAULT 'content_validated'"); } catch (e) {}
try { db.exec("ALTER TABLE uploads ADD COLUMN expires_at INTEGER"); } catch (e) {}
try { db.exec("ALTER TABLE uploads ADD COLUMN deleted_at INTEGER"); } catch (e) {}
try { db.exec("CREATE UNIQUE INDEX idx_uploads_owner_content ON uploads(owner_user_id, kind, content_sha256) WHERE deleted_at IS NULL AND content_sha256 IS NOT NULL"); } catch (e) {}

// 验证码 v2：旧表保存明文且没有用途、尝试次数和消费状态。
// 迁移时主动使所有旧验证码失效，避免把明文凭证带入新结构。
const verificationColumns = new Set(
  db.prepare('PRAGMA table_info(verification_codes)').all().map((column) => column.name),
);
if (verificationColumns.has('code') || !verificationColumns.has('code_digest')) {
  db.transaction(() => {
    db.exec('DROP TABLE IF EXISTS verification_codes_v2');
    db.exec(`
      CREATE TABLE verification_codes_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT COLLATE NOCASE NOT NULL,
        purpose TEXT NOT NULL CHECK (purpose IN ('register', 'reset')),
        code_digest TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
        max_attempts INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 20),
        consumed_at INTEGER,
        created_at INTEGER NOT NULL,
        UNIQUE(email, purpose)
      );
      DROP TABLE verification_codes;
      ALTER TABLE verification_codes_v2 RENAME TO verification_codes;
    `);
  }).immediate();
}
db.exec('CREATE INDEX IF NOT EXISTS idx_verification_codes_expires_at ON verification_codes(expires_at)');

// 一次性清理遗留密码：旧版 scrypt 可无损加上格式版本；未知/明文格式作废并强制走邮箱重置。
// 随机替换值不会返回或持久化，因此无法作为临时密码使用。
const passwordFormatMigration = db.prepare("SELECT value FROM settings WHERE key = 'migration_password_format_v1'").get();
if (!passwordFormatMigration) {
  const modernScryptPattern = /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/i;
  const legacyScryptPattern = /^([a-f0-9]{32}):([a-f0-9]{128})$/i;
  const bcryptPattern = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

  db.transaction(() => {
    const users = db.prepare('SELECT id, password FROM users').all();
    const upgradeLegacy = db.prepare('UPDATE users SET password = ? WHERE id = ?');
    const invalidateUnknown = db.prepare(`
      UPDATE users
      SET password = ?, password_reset_required = 1, session_version = session_version + 1
      WHERE id = ?
    `);

    for (const user of users) {
      const stored = String(user.password ?? '').trim();
      if (modernScryptPattern.test(stored) || bcryptPattern.test(stored)) continue;

      const legacy = stored.match(legacyScryptPattern);
      if (legacy) {
        upgradeLegacy.run(`scrypt$${legacy[1]}$${legacy[2]}`, user.id);
        continue;
      }

      const replacementSecret = crypto.randomBytes(48).toString('base64url');
      const salt = crypto.randomBytes(16).toString('hex');
      const replacementHash = `scrypt$${salt}$${crypto.scryptSync(replacementSecret, salt, 64).toString('hex')}`;
      invalidateUnknown.run(replacementHash, user.id);
    }

    db.prepare("INSERT INTO settings (key, value) VALUES ('migration_password_format_v1', 'completed')").run();
  })();
}

// 角色规范化可重复执行。
db.transaction(() => {
  db.prepare("UPDATE users SET role = 'user' WHERE role = 'standard'").run();
  db.prepare("UPDATE users SET role = 'developer' WHERE role = 'dev'").run();
})();

// 文本身份只允许在迁移时匹配一次。留下的孤儿记录永久保持 NULL，防止未来同名注册后被重新认领。
const identityMigration = db.prepare("SELECT value FROM settings WHERE key = 'migration_user_id_v1'").get();
if (!identityMigration) {
  db.transaction(() => {
    db.prepare(`
      UPDATE products SET author_user_id = (
        SELECT id FROM users WHERE deleted_at IS NULL AND LOWER(users.username) = LOWER(products.author)
      ) WHERE author_user_id IS NULL
    `).run();
    db.prepare(`
      UPDATE orders SET buyer_user_id = (
        SELECT id FROM users WHERE deleted_at IS NULL AND LOWER(users.username) = LOWER(orders.username)
      ) WHERE buyer_user_id IS NULL
    `).run();
    db.prepare(`
      UPDATE posts SET author_user_id = (
        SELECT id FROM users WHERE deleted_at IS NULL AND LOWER(users.username) = LOWER(posts.author)
      ) WHERE author_user_id IS NULL
    `).run();
    db.prepare(`
      UPDATE comments SET author_user_id = (
        SELECT id FROM users WHERE deleted_at IS NULL AND LOWER(users.username) = LOWER(comments.author)
      ) WHERE author_user_id IS NULL
    `).run();
    db.prepare(`
      UPDATE withdrawals SET user_id = (
        SELECT id FROM users WHERE deleted_at IS NULL AND LOWER(users.username) = LOWER(withdrawals.username)
      ) WHERE user_id IS NULL
    `).run();
    db.prepare("INSERT INTO settings (key, value) VALUES ('migration_user_id_v1', 'completed')").run();
  })();
}

// 旧索引依赖可变用户名；迁移后唯一性和检索全部绑定稳定用户 ID。
db.exec(`
  DROP INDEX IF EXISTS idx_withdrawals_one_pending_per_user;
  DROP INDEX IF EXISTS idx_orders_one_per_user_product;

  CREATE UNIQUE INDEX IF NOT EXISTS idx_withdrawals_one_pending_per_user_id
    ON withdrawals(user_id) WHERE status = 'pending' AND user_id IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_one_per_user_product_id
    ON orders(buyer_user_id, product_id) WHERE buyer_user_id IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_products_author_user_id ON products(author_user_id);
  CREATE INDEX IF NOT EXISTS idx_posts_author_user_id ON posts(author_user_id);
  CREATE INDEX IF NOT EXISTS idx_comments_author_user_id ON comments(author_user_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_decision_key
    ON orders(decision_key) WHERE decision_key IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_withdrawals_decision_key
    ON withdrawals(decision_key) WHERE decision_key IS NOT NULL;
`);

// 为旧产品建立不可变的初始版本快照。只迁移仍有合法私有上传记录的产品；
// 无法确认来源的遗留 file_url 保持未版本化，避免错误授予下载权益。
const productVersionMigration = db.prepare("SELECT value FROM settings WHERE key='migration_product_versions_v1'").get();
if (!productVersionMigration) {
  db.transaction(() => {
    const legacyProducts = db.prepare(`
      SELECT p.id product_id,p.author_user_id,p.file_url,p.created_at,u.id upload_id,u.content_sha256
      FROM products p JOIN uploads u ON u.attached_product_id=p.id AND u.kind='ea' AND u.url=p.file_url
      WHERE p.author_user_id IS NOT NULL AND p.file_url IS NOT NULL AND u.deleted_at IS NULL AND u.content_sha256 IS NOT NULL
        AND NOT EXISTS(SELECT 1 FROM product_versions v WHERE v.product_id=p.id)
    `).all();
    const insert = db.prepare(`INSERT INTO product_versions
      (product_id,version,release_notes,upload_id,file_url,content_sha256,upgrade_policy,entitlement_cutoff,status,is_current,submitted_by_user_id,reviewed_by_user_id,created_at,reviewed_at,released_at)
      VALUES(?,'1.0.0','Legacy release migrated by Nexus',?,?,?,'all_existing',NULL,'published',1,?,?,?, ?, ?)`);
    const timestamp = Date.now();
    for (const item of legacyProducts) {
      insert.run(item.product_id,item.upload_id,item.file_url,item.content_sha256 || '',item.author_user_id,null,timestamp,null,timestamp);
    }
    db.prepare("INSERT INTO settings(key,value) VALUES('migration_product_versions_v1','completed')").run();
  }).immediate();
}

// 将现有有效订单映射为永久授权。订单仍是财务事实，license 是运行/下载授权事实。
const licenseMigration=db.prepare("SELECT value FROM settings WHERE key='migration_product_licenses_v1'").get();
if(!licenseMigration){
  db.transaction(()=>{
    const orders=db.prepare("SELECT o.id,o.buyer_user_id,o.product_id,o.price,o.created_at FROM orders o JOIN products p ON p.id=o.product_id JOIN users u ON u.id=o.buyer_user_id WHERE o.buyer_user_id IS NOT NULL AND o.status='completed' AND (o.price=0 OR o.payment_verified=1)").all();
    const insert=db.prepare(`INSERT OR IGNORE INTO product_licenses(user_id,product_id,version_id,source_order_id,license_type,status,starts_at,expires_at,token_version,created_at)
      VALUES(?,?,NULL,?,?, 'active',?,NULL,1,?)`);
    for(const order of orders){const parsed=new Date(order.created_at).getTime();const startsAt=Number.isFinite(parsed)?parsed:Date.now();insert.run(order.buyer_user_id,order.product_id,order.id,Number(order.price)===0?'free':'purchase',startsAt,startsAt);}
    db.prepare("INSERT INTO settings(key,value) VALUES('migration_product_licenses_v1','completed')").run();
  }).immediate();
}

export default db;
