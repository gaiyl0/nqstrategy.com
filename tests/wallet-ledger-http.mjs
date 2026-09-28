import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

const root = process.cwd();
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-wallet-http-'));
const databasePath = path.join(tempRoot, 'runtime.db');
const port = 3199;
const origin = 'https://nexus.test';
const jwtSecret = 'http-test-jwt-secret-0123456789-abcdef';
const env = {
  ...process.env,
  NODE_ENV: 'production',
  NEXUS_DB_PATH: databasePath,
  NEXUS_AUTO_MIGRATE: '1',
  JWT_SECRET: jwtSecret,
  AUDIT_HASH_SECRET: 'http-test-audit-hash-0123456789-abcdef',
  VERIFICATION_CODE_SECRET: 'http-test-code-secret-0123456789-abcdef',
  AUDIT_INTEGRITY_SECRET: 'http-test-audit-integrity-0123456789-abcdef',
  LEDGER_INTEGRITY_SECRET: 'http-test-ledger-integrity-0123456789-abcdef',
  LICENSE_SIGNING_SECRET: 'http-test-license-signing-0123456789-abcdef',
  LICENSE_BINDING_SECRET: 'http-test-license-binding-0123456789-abcdef',
  AUDIT_RETENTION_DAYS: '180',
  AUDIT_ARCHIVE_DIR: 'storage/audit-archives',
  TRUSTED_PROXY_MODE: 'nginx',
  TRUSTED_PROXY_SHARED_SECRET: 'http-test-proxy-secret-0123456789-abcdef',
  RATE_LIMIT_BACKEND: 'sqlite',
  DEPLOYMENT_TOPOLOGY: 'single-instance',
  APP_ORIGINS: origin,
};

function sessionCookie(userId) {
  const payload = Buffer.from(JSON.stringify({ id: userId, sv: 1, exp: Date.now() + 60_000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', jwtSecret).update(payload).digest('base64url');
  return `nexus_token=${payload}.${signature}`;
}

async function jsonRequest(pathname, method, cookie, body, idempotencyKey) {
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`, {
    method,
    headers: {
      Origin: origin,
      'Content-Type': 'application/json',
      Cookie: cookie,
      'X-Nexus-Proxy-Secret': env.TRUSTED_PROXY_SHARED_SECRET,
      'X-Real-IP': cookie === adminCookie ? '192.0.2.10' : '192.0.2.20',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

let server;
let adminCookie;
let userCookie;
let serverOutput = '';
try {
  // Create the schema in a separate process so this test process never keeps the DB open.
  const seed = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import db from './lib/db.js';
    db.prepare("INSERT INTO users (username,email,role,password,balance) VALUES ('admin','admin@test.invalid','admin','test-hash',0)").run();
    db.prepare("INSERT INTO users (username,email,role,password,balance) VALUES ('trader','trader@test.invalid','user','test-hash',0)").run();
    db.close();
  `], { cwd: root, env, encoding: 'utf8' });
  assert.equal(seed.status, 0, seed.stderr);
  adminCookie = sessionCookie(1);
  userCookie = sessionCookie(2);

  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port)], {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  server.stdout.on('data', (chunk) => { serverOutput += chunk; });
  server.stderr.on('data', (chunk) => { serverOutput += chunk; });
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      if (response.ok) { ready = true; break; }
    } catch {}
  }
  assert.equal(ready, true, `production server did not become ready\n${serverOutput}`);

  const adjusted = await jsonRequest('/api/users', 'PATCH', adminCookie, { id: 2, manualBalance: 500 }, 'http-admin-adjust-1');
  assert.equal(adjusted.status, 200, JSON.stringify(adjusted.body));
  assert.equal(adjusted.body.balance, 500);
  const adjustedReplay = await jsonRequest('/api/users', 'PATCH', adminCookie, { id: 2, manualBalance: 500 }, 'http-admin-adjust-1');
  assert.equal(adjustedReplay.status, 200);
  assert.equal(adjustedReplay.body.replayed, true);

  const requested = await jsonRequest('/api/withdraw', 'POST', userCookie, {
    address: '0x1111111111111111111111111111111111111111',
    amount: 100,
  });
  assert.equal(requested.status, 201, JSON.stringify(requested.body));
  const withdrawalId = requested.body.withdrawal.id;

  const decisions = await Promise.all([
    jsonRequest('/api/withdraw', 'PATCH', adminCookie, { id: withdrawalId, status: 'rejected' }, 'http-withdrawal-review-a'),
    jsonRequest('/api/withdraw', 'PATCH', adminCookie, { id: withdrawalId, status: 'rejected' }, 'http-withdrawal-review-b'),
  ]);
  assert.deepEqual(decisions.map((item) => item.status).sort(), [200, 409]);
  const winningKey = decisions[0].status === 200 ? 'http-withdrawal-review-a' : 'http-withdrawal-review-b';
  const replay = await jsonRequest('/api/withdraw', 'PATCH', adminCookie, { id: withdrawalId, status: 'rejected' }, winningKey);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.replayed, true);

  server.kill();
  await new Promise((resolve) => server.once('exit', resolve));
  server = null;

  const db = new Database(databasePath, { readonly: true });
  assert.equal(db.prepare('SELECT balance FROM users WHERE id = 2').get().balance, 500);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM wallet_transactions WHERE user_id = 2 AND transaction_type = 'WITHDRAWAL_HOLD'").get().count, 1);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM wallet_transactions WHERE user_id = 2 AND transaction_type = 'WITHDRAWAL_REFUND'").get().count, 1);
  assert.equal(db.prepare('SELECT status FROM withdrawals WHERE id = ?').get(withdrawalId).status, 'rejected');
  db.close();

  const verify = spawnSync(process.execPath, ['scripts/ledger-maintenance.mjs'], { cwd: root, env, encoding: 'utf8' });
  assert.equal(verify.status, 0, verify.stdout + verify.stderr);
  const result = JSON.parse(verify.stdout);
  assert.equal(result.valid, true);
  console.log(JSON.stringify({ success: true, decisions: decisions.map((item) => item.status), verification: result }, null, 2));
} finally {
  if (server && server.exitCode === null) {
    server.kill();
    await Promise.race([
      new Promise((resolve) => server.once('exit', resolve)),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);
  }
  fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
