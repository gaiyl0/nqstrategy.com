import db from './db.js';
import { decryptPaymentSecret, encryptPaymentSecret } from './payment-secret-vault.mjs';

const storageKey = name => `paymentVault:${name}`;
export function readPaymentSecret(name) {
  const stored = db.prepare('SELECT value FROM settings WHERE key=?').get(storageKey(name))?.value;
  return stored ? decryptPaymentSecret(stored, name) : String(process.env[name] || '').replaceAll('\\n', '\n').trim();
}
export function paymentSecretConfigured(name) {
  try { return Boolean(readPaymentSecret(name)); } catch { return false; }
}
export function savePaymentSecrets(values) {
  const encrypted = Object.entries(values).map(([name, value]) => [storageKey(name), encryptPaymentSecret(value, name)]);
  db.transaction(() => {
    const statement = db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)');
    for (const entry of encrypted) statement.run(...entry);
  })();
}
