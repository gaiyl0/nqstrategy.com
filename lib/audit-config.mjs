import path from 'node:path';

const MIN_RETENTION_DAYS = 30;
const MAX_RETENTION_DAYS = 3650;

function parseSecretList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function validateAuditConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const integritySecret = String(env.AUDIT_INTEGRITY_SECRET || '');
  const previousSecrets = parseSecretList(env.AUDIT_INTEGRITY_PREVIOUS_SECRETS);
  const retentionText = String(env.AUDIT_RETENTION_DAYS || (production ? '' : '180')).trim();
  const retentionDays = Number(retentionText);
  const archiveDirText = String(env.AUDIT_ARCHIVE_DIR || 'storage/audit-archives').trim();

  if (production && integritySecret.length < 32) {
    throw new Error('AUDIT_INTEGRITY_SECRET must contain at least 32 characters in production');
  }
  if (integritySecret && integritySecret.length < 32) {
    throw new Error('AUDIT_INTEGRITY_SECRET must contain at least 32 characters');
  }
  if (previousSecrets.some((secret) => secret.length < 32)) {
    throw new Error('Every AUDIT_INTEGRITY_PREVIOUS_SECRETS value must contain at least 32 characters');
  }
  if (!Number.isInteger(retentionDays) || retentionDays < MIN_RETENTION_DAYS || retentionDays > MAX_RETENTION_DAYS) {
    throw new Error(`AUDIT_RETENTION_DAYS must be an integer between ${MIN_RETENTION_DAYS} and ${MAX_RETENTION_DAYS}`);
  }
  if (!archiveDirText || path.isAbsolute(archiveDirText) || archiveDirText.split(/[\\/]+/).includes('..')) {
    throw new Error('AUDIT_ARCHIVE_DIR must be a relative path without parent traversal');
  }

  return {
    production,
    integritySecret: integritySecret || null,
    previousSecrets,
    retentionDays,
    retentionMs: retentionDays * 24 * 60 * 60 * 1000,
    archiveDir: path.resolve(/* turbopackIgnore: true */ process.cwd(), archiveDirText),
    archiveDirRelative: archiveDirText.replace(/\\/g, '/'),
  };
}

if (process.env.NODE_ENV === 'production') {
  validateAuditConfig(process.env);
}
