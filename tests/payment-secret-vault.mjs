import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { encryptPaymentSecret, decryptPaymentSecret, normalizeAlipayKey } from '../lib/payment-secret-vault.mjs';

const env = { PAYMENT_SECRET_ENCRYPTION_KEY: 'test-only-vault-secret-'.repeat(3) };
const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const privatePem = pair.privateKey.export({ type: 'pkcs8', format: 'pem' });
const publicPem = pair.publicKey.export({ type: 'spki', format: 'pem' });
assert.equal(normalizeAlipayKey(privatePem, true), privatePem);
assert.equal(normalizeAlipayKey(pair.privateKey.export({ type: 'pkcs1', format: 'pem' }).replace(/-----[^\n]+-----|\s/g, ''), true), privatePem);
assert.equal(normalizeAlipayKey(publicPem.replace(/-----[^\n]+-----|\s/g, '')), publicPem);
assert.throws(() => normalizeAlipayKey(publicPem, true));
assert.throws(() => normalizeAlipayKey('bad-key'));
const encrypted = encryptPaymentSecret(privatePem, 'ALIPAY_APP_PRIVATE_KEY', env);
assert.ok(!encrypted.includes('PRIVATE KEY'));
assert.equal(decryptPaymentSecret(encrypted, 'ALIPAY_APP_PRIVATE_KEY', env), privatePem);
assert.notEqual(encrypted, encryptPaymentSecret(privatePem, 'ALIPAY_APP_PRIVATE_KEY', env));
assert.throws(() => decryptPaymentSecret(encrypted, 'ALIPAY_PUBLIC_KEY', env));
assert.throws(() => decryptPaymentSecret(encrypted, 'ALIPAY_APP_PRIVATE_KEY', { JWT_SECRET: 'different-secret-'.repeat(4) }));
assert.throws(() => encryptPaymentSecret('x', 'x', {}));
const fields = encrypted.split('.');
const bytes = Buffer.from(fields[3], 'base64'); bytes[0] ^= 1; fields[3] = bytes.toString('base64');
assert.throws(() => decryptPaymentSecret(fields.join('.'), 'ALIPAY_APP_PRIVATE_KEY', env));

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-vault-test-'));
process.env.NEXUS_DB_PATH = path.join(temporary, 'test.db');
process.env.NEXUS_AUTO_MIGRATE = '1';
process.env.PAYMENT_SECRET_ENCRYPTION_KEY = env.PAYMENT_SECRET_ENCRYPTION_KEY;
process.env.ALIPAY_PUBLIC_KEY = publicPem;
const db = (await import('../lib/db.js')).default;
try {
  const store = await import('../lib/payment-secret-store.js');
  assert.equal(store.readPaymentSecret('ALIPAY_PUBLIC_KEY'), publicPem.trim());
  store.savePaymentSecrets({ ALIPAY_APP_PRIVATE_KEY: privatePem });
  assert.equal(store.readPaymentSecret('ALIPAY_APP_PRIVATE_KEY'), privatePem);
  assert.ok(store.paymentSecretConfigured('ALIPAY_APP_PRIVATE_KEY'));
  const raw = db.prepare("SELECT value FROM settings WHERE key='paymentVault:ALIPAY_APP_PRIVATE_KEY'").get().value;
  assert.ok(!raw.includes(privatePem));
  assert.equal(store.readPaymentSecret('ALIPAY_PUBLIC_KEY'), publicPem.trim(), 'partial save retains existing values');
  process.env.PAYMENT_SECRET_ENCRYPTION_KEY = 'wrong-secret-'.repeat(4);
  assert.equal(store.paymentSecretConfigured('ALIPAY_APP_PRIVATE_KEY'), false, 'unreadable ciphertext is not marked ready');
} finally { db.close(); fs.rmSync(temporary, { recursive: true, force: true }); }
console.log('Payment vault passed: encryption, tamper detection, RSA validation, environment fallback, partial saves and ciphertext storage');
