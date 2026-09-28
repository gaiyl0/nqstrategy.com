import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import db, { withWalletMaintenance } from './db.js';
import { validateLedgerConfig } from './ledger-config.mjs';

const GENESIS_HASH = '0'.repeat(64);
const DEV_KEY_PATH = path.resolve(process.cwd(), 'storage/secrets/ledger-integrity.key');

function keyId(secret) {
  return crypto.createHash('sha256').update(secret).digest('hex').slice(0, 16);
}

function developmentSecret() {
  try {
    const existing = fs.readFileSync(DEV_KEY_PATH, 'utf8').trim();
    if (existing.length >= 32) return existing;
  } catch {}
  fs.mkdirSync(path.dirname(DEV_KEY_PATH), { recursive: true });
  const generated = crypto.randomBytes(48).toString('base64url');
  try { fs.writeFileSync(DEV_KEY_PATH, `${generated}\n`, { flag: 'wx', mode: 0o600 }); return generated; }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    return fs.readFileSync(DEV_KEY_PATH, 'utf8').trim();
  }
}

function keyRing() {
  const config = validateLedgerConfig(process.env);
  const current = config.integritySecret || developmentSecret();
  const previous = config.previousSecrets;
  return { current, currentId: keyId(current), keys: new Map([current, ...previous].map((secret) => [keyId(secret), secret])) };
}

function canonical(row) {
  return JSON.stringify([
    row.user_id, row.transaction_type, row.business_key, row.idempotency_key ?? null,
    row.amount_minor, row.balance_before_minor, row.balance_after_minor,
    row.order_id ?? null, row.withdrawal_id ?? null, row.actor_user_id ?? null,
    row.metadata_json ?? null, row.previous_hash, row.integrity_key_id, row.created_at,
  ]);
}

function sign(row, secret) {
  return crypto.createHmac('sha256', secret).update(`wallet-entry:v1:${canonical(row)}`).digest('hex');
}

function secureEqual(left, right) {
  try {
    const a = Buffer.from(String(left), 'hex');
    const b = Buffer.from(String(right), 'hex');
    return a.length === 32 && b.length === 32 && crypto.timingSafeEqual(a, b);
  } catch { return false; }
}

export function moneyToMinor(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-7) {
    throw new Error('BALANCE_PRECISION_INVALID');
  }
  return Math.round(amount * 100);
}

function installTriggers() {
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS users_balance_block_nonzero_insert
    BEFORE INSERT ON users
    WHEN NEW.balance != 0 AND wallet_maintenance_allowed() = 0
    BEGIN SELECT RAISE(ABORT, 'user balance requires wallet ledger'); END;
    CREATE TRIGGER IF NOT EXISTS users_balance_block_update
    BEFORE UPDATE OF balance ON users
    WHEN NEW.balance != OLD.balance AND wallet_maintenance_allowed() = 0
    BEGIN SELECT RAISE(ABORT, 'user balance requires wallet ledger'); END;
    CREATE TRIGGER IF NOT EXISTS wallet_transactions_block_insert
    BEFORE INSERT ON wallet_transactions WHEN wallet_maintenance_allowed() = 0
    BEGIN SELECT RAISE(ABORT, 'wallet ledger writes require controlled transaction'); END;
    CREATE TRIGGER IF NOT EXISTS wallet_transactions_block_update
    BEFORE UPDATE ON wallet_transactions WHEN wallet_maintenance_allowed() = 0
    BEGIN SELECT RAISE(ABORT, 'wallet ledger is immutable'); END;
    CREATE TRIGGER IF NOT EXISTS wallet_transactions_block_delete
    BEFORE DELETE ON wallet_transactions WHEN wallet_maintenance_allowed() = 0
    BEGIN SELECT RAISE(ABORT, 'wallet ledger is immutable'); END;
  `);
}

function appendRow(input) {
  const ring = keyRing();
  const latest = db.prepare('SELECT id, balance_after_minor, entry_hash FROM wallet_transactions WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(input.userId);
  const row = {
    user_id: input.userId, transaction_type: input.transactionType,
    business_key: input.businessKey, idempotency_key: input.idempotencyKey || null,
    amount_minor: input.amountMinor, balance_before_minor: input.balanceBeforeMinor,
    balance_after_minor: input.balanceAfterMinor, order_id: input.orderId || null,
    withdrawal_id: input.withdrawalId || null, actor_user_id: input.actorUserId || null,
    metadata_json: input.metadata ? JSON.stringify(input.metadata).slice(0, 2000) : null,
    previous_hash: latest?.entry_hash || GENESIS_HASH, integrity_key_id: ring.currentId,
    created_at: input.createdAt || Date.now(),
  };
  if (latest && latest.balance_after_minor !== row.balance_before_minor) throw new Error('LEDGER_BALANCE_CHAIN_BROKEN');
  row.entry_hash = sign(row, ring.current);
  const result = withWalletMaintenance(() => db.prepare(`INSERT INTO wallet_transactions
    (user_id,transaction_type,business_key,idempotency_key,amount_minor,balance_before_minor,
     balance_after_minor,order_id,withdrawal_id,actor_user_id,metadata_json,previous_hash,
     integrity_key_id,entry_hash,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    row.user_id,row.transaction_type,row.business_key,row.idempotency_key,row.amount_minor,
    row.balance_before_minor,row.balance_after_minor,row.order_id,row.withdrawal_id,row.actor_user_id,
    row.metadata_json,row.previous_hash,row.integrity_key_id,row.entry_hash,row.created_at,
  ));
  return Number(result.lastInsertRowid);
}

export function applyWalletDelta(input) {
  const operation = db.transaction(() => withWalletMaintenance(() => {
    const existing = db.prepare('SELECT * FROM wallet_transactions WHERE business_key = ?').get(input.businessKey);
    if (existing) {
      if (existing.user_id !== input.userId || existing.transaction_type !== input.transactionType || existing.amount_minor !== input.amountMinor) {
        throw new Error('LEDGER_IDEMPOTENCY_CONFLICT');
      }
      return { replayed: true, transactionId: existing.id, balanceAfterMinor: existing.balance_after_minor };
    }
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor === 0) throw new Error('LEDGER_AMOUNT_INVALID');
    const user = db.prepare('SELECT id, balance FROM users WHERE id = ? AND deleted_at IS NULL').get(input.userId);
    if (!user) throw new Error('LEDGER_USER_NOT_FOUND');
    const before = moneyToMinor(user.balance);
    const after = before + input.amountMinor;
    if (after < 0) throw new Error('LEDGER_INSUFFICIENT_BALANCE');
    const update = db.prepare('UPDATE users SET balance = ? WHERE id = ? AND ABS(balance - ?) < 0.0000001')
      .run(after / 100, input.userId, before / 100);
    if (update.changes !== 1) throw new Error('LEDGER_BALANCE_CONFLICT');
    const transactionId = appendRow({ ...input, balanceBeforeMinor: before, balanceAfterMinor: after });
    return { replayed: false, transactionId, balanceAfterMinor: after };
  }));
  return operation.immediate();
}

export function setWalletBalance(input) {
  const user = db.prepare('SELECT balance FROM users WHERE id = ? AND deleted_at IS NULL').get(input.userId);
  if (!user) throw new Error('LEDGER_USER_NOT_FOUND');
  const target = moneyToMinor(input.balance);
  const current = moneyToMinor(user.balance);
  const existing = db.prepare('SELECT * FROM wallet_transactions WHERE business_key = ?').get(input.businessKey);
  if (existing) {
    if (existing.user_id !== input.userId || existing.transaction_type !== 'ADMIN_ADJUSTMENT' || existing.balance_after_minor !== target) {
      throw new Error('LEDGER_IDEMPOTENCY_CONFLICT');
    }
    return applyWalletDelta({ ...input, transactionType: 'ADMIN_ADJUSTMENT', amountMinor: existing.amount_minor });
  }
  if (target === current) throw new Error('LEDGER_NO_CHANGE');
  return applyWalletDelta({ ...input, transactionType: 'ADMIN_ADJUSTMENT', amountMinor: target - current });
}

export function verifyWalletLedger() {
  const ring = keyRing();
  const issues = [];
  const users = db.prepare('SELECT id, balance FROM users ORDER BY id').all();
  for (const user of users) {
    let expectedHash = GENESIS_HASH;
    let expectedBalance = 0;
    const rows = db.prepare('SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY id').all(user.id);
    for (const row of rows) {
      const secret = ring.keys.get(row.integrity_key_id);
      if (!secret || !secureEqual(row.entry_hash, sign(row, secret))) issues.push({ userId: user.id, transactionId: row.id, code: 'SIGNATURE_INVALID' });
      if (row.previous_hash !== expectedHash) issues.push({ userId: user.id, transactionId: row.id, code: 'HASH_CHAIN_BROKEN' });
      if (row.balance_before_minor !== expectedBalance) issues.push({ userId: user.id, transactionId: row.id, code: 'BALANCE_BEFORE_MISMATCH' });
      if (row.balance_before_minor + row.amount_minor !== row.balance_after_minor) issues.push({ userId: user.id, transactionId: row.id, code: 'AMOUNT_MISMATCH' });
      expectedHash = row.entry_hash;
      expectedBalance = row.balance_after_minor;
    }
    try {
      if (moneyToMinor(user.balance) !== expectedBalance) issues.push({ userId: user.id, code: 'USER_BALANCE_MISMATCH' });
    } catch { issues.push({ userId: user.id, code: 'USER_BALANCE_INVALID' }); }
  }
  return { valid: issues.length === 0, users: users.length, transactions: db.prepare('SELECT COUNT(*) count FROM wallet_transactions').get().count, issues };
}

function initializeOpeningBalances() {
  const users = db.prepare('SELECT id, balance FROM users ORDER BY id').all();
  withWalletMaintenance(() => db.transaction(() => {
    for (const user of users) {
      const exists = db.prepare('SELECT id FROM wallet_transactions WHERE user_id = ? LIMIT 1').get(user.id);
      if (exists) continue;
      const balance = moneyToMinor(user.balance);
      appendRow({ userId: user.id, transactionType: 'OPENING_BALANCE', businessKey: `opening:user:${user.id}`, amountMinor: balance, balanceBeforeMinor: 0, balanceAfterMinor: balance, metadata: { migration: true } });
    }
  }).immediate());
}

installTriggers();
initializeOpeningBalances();
const initialVerification = verifyWalletLedger();
if (!initialVerification.valid) throw new Error(`Wallet ledger integrity failure: ${initialVerification.issues[0]?.code}`);
