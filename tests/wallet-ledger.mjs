import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-wallet-ledger-'));
process.env.NODE_ENV = 'test';
process.env.NEXUS_DB_PATH = path.join(tempRoot, 'ledger.db');
let db;

try {
  const dbModule = await import('../lib/db.js');
  db = dbModule.default;
  const { withWalletMaintenance } = dbModule;
  const insertUser = db.prepare(`
    INSERT INTO users (username, email, role, password, balance)
    VALUES (?, ?, ?, 'test-hash', ?)
  `);
  const adminId = Number(insertUser.run('admin', 'admin@example.test', 'admin', 0).lastInsertRowid);
  const userId = Number(withWalletMaintenance(() => insertUser.run('trader', 'trader@example.test', 'user', 500)).lastInsertRowid);

  const {
    applyWalletDelta,
    moneyToMinor,
    setWalletBalance,
    verifyWalletLedger,
  } = await import('../lib/wallet-ledger.mjs');

  let verification = verifyWalletLedger();
  assert.equal(verification.valid, true);
  assert.equal(verification.transactions, 2);
  assert.equal(moneyToMinor(10.25), 1025);
  assert.throws(() => moneyToMinor(10.001), /BALANCE_PRECISION_INVALID/);

  const adjustment = setWalletBalance({
    userId,
    balance: 600,
    businessKey: 'admin-adjustment:test-1',
    idempotencyKey: 'test-adjustment-1',
    actorUserId: adminId,
  });
  assert.equal(adjustment.replayed, false);
  assert.equal(adjustment.balanceAfterMinor, 60000);
  const adjustmentReplay = setWalletBalance({
    userId,
    balance: 600,
    businessKey: 'admin-adjustment:test-1',
    idempotencyKey: 'test-adjustment-1',
    actorUserId: adminId,
  });
  assert.equal(adjustmentReplay.replayed, true);
  assert.equal(db.prepare('SELECT COUNT(*) count FROM wallet_transactions WHERE business_key = ?').get('admin-adjustment:test-1').count, 1);

  assert.throws(() => setWalletBalance({
    userId,
    balance: 700,
    businessKey: 'admin-adjustment:test-1',
    idempotencyKey: 'test-adjustment-1',
    actorUserId: adminId,
  }), /LEDGER_IDEMPOTENCY_CONFLICT/);

  const withdrawalId = Number(db.prepare(`
    INSERT INTO withdrawals (username, user_id, amount, crypto_address, status)
    VALUES ('trader', ?, 100, '0x1111111111111111111111111111111111111111', 'pending')
  `).run(userId).lastInsertRowid);
  const hold = applyWalletDelta({
    userId,
    transactionType: 'WITHDRAWAL_HOLD',
    businessKey: `withdrawal:${withdrawalId}:hold`,
    amountMinor: -10000,
    withdrawalId,
    actorUserId: userId,
  });
  assert.equal(hold.balanceAfterMinor, 50000);
  const refund = applyWalletDelta({
    userId,
    transactionType: 'WITHDRAWAL_REFUND',
    businessKey: `withdrawal:${withdrawalId}:refund`,
    idempotencyKey: 'withdrawal-review-1',
    amountMinor: 10000,
    withdrawalId,
    actorUserId: adminId,
  });
  assert.equal(refund.balanceAfterMinor, 60000);
  assert.equal(applyWalletDelta({
    userId,
    transactionType: 'WITHDRAWAL_REFUND',
    businessKey: `withdrawal:${withdrawalId}:refund`,
    idempotencyKey: 'withdrawal-review-1',
    amountMinor: 10000,
    withdrawalId,
    actorUserId: adminId,
  }).replayed, true);
  assert.throws(() => applyWalletDelta({
    userId,
    transactionType: 'WITHDRAWAL_HOLD',
    businessKey: 'withdrawal:too-large:hold',
    amountMinor: -70000,
    actorUserId: userId,
  }), /LEDGER_INSUFFICIENT_BALANCE/);

  assert.throws(() => db.prepare('UPDATE users SET balance = balance + 1 WHERE id = ?').run(userId), /user balance requires wallet ledger/);
  assert.throws(() => db.prepare(`INSERT INTO wallet_transactions
    (user_id,transaction_type,business_key,amount_minor,balance_before_minor,balance_after_minor,previous_hash,integrity_key_id,entry_hash,created_at)
    VALUES (?, 'ADMIN_ADJUSTMENT', 'forged', 1, 0, 1, '', '', '', 1)`).run(userId), /wallet ledger writes require controlled transaction/);
  assert.throws(() => db.prepare('UPDATE wallet_transactions SET amount_minor = 1 WHERE business_key = ?').run('admin-adjustment:test-1'), /wallet ledger is immutable/);
  assert.throws(() => db.prepare('DELETE FROM wallet_transactions WHERE business_key = ?').run('admin-adjustment:test-1'), /wallet ledger is immutable/);

  const originalRow = db.prepare('SELECT * FROM wallet_transactions WHERE business_key = ?').get('admin-adjustment:test-1');
  withWalletMaintenance(() => db.prepare('UPDATE wallet_transactions SET amount_minor = amount_minor + 1 WHERE id = ?').run(originalRow.id));
  verification = verifyWalletLedger();
  assert.equal(verification.valid, false);
  assert.ok(verification.issues.some((issue) => issue.code === 'SIGNATURE_INVALID' || issue.code === 'AMOUNT_MISMATCH'));
  withWalletMaintenance(() => db.prepare('UPDATE wallet_transactions SET amount_minor = ? WHERE id = ?').run(originalRow.amount_minor, originalRow.id));
  assert.equal(verifyWalletLedger().valid, true);

  withWalletMaintenance(() => db.prepare('UPDATE users SET balance = balance + 1 WHERE id = ?').run(userId));
  verification = verifyWalletLedger();
  assert.equal(verification.valid, false);
  assert.ok(verification.issues.some((issue) => issue.code === 'USER_BALANCE_MISMATCH'));
  withWalletMaintenance(() => db.prepare('UPDATE users SET balance = balance - 1 WHERE id = ?').run(userId));
  assert.equal(verifyWalletLedger().valid, true);

  assert.equal(db.prepare('SELECT balance FROM users WHERE id = ?').get(userId).balance, 600);
  assert.equal(db.prepare('SELECT COUNT(*) count FROM wallet_transactions WHERE withdrawal_id = ? AND transaction_type = ?').get(withdrawalId, 'WITHDRAWAL_REFUND').count, 1);
  console.log(JSON.stringify({ success: true, verification: verifyWalletLedger() }, null, 2));
} finally {
  db?.close();
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
