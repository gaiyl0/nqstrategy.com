export function validateLedgerConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const integritySecret = String(env.LEDGER_INTEGRITY_SECRET || '');
  const previousSecrets = String(env.LEDGER_INTEGRITY_PREVIOUS_SECRETS || '').split(',').map((item) => item.trim()).filter(Boolean);
  if (production && integritySecret.length < 32) throw new Error('LEDGER_INTEGRITY_SECRET must contain at least 32 characters in production');
  if (integritySecret && integritySecret.length < 32) throw new Error('LEDGER_INTEGRITY_SECRET must contain at least 32 characters');
  if (previousSecrets.some((secret) => secret.length < 32)) throw new Error('Every LEDGER_INTEGRITY_PREVIOUS_SECRETS value must contain at least 32 characters');
  return { integritySecret: integritySecret || null, previousSecrets };
}

if (process.env.NODE_ENV === 'production') validateLedgerConfig(process.env);
