import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { migrations } from '../lib/migrations.js';

const root = process.cwd();
const command = process.argv[2];
const args = process.argv.slice(3);
const sourceDatabase = path.resolve(process.env.NEXUS_DB_PATH || path.join(root, 'data.db'));
const defaultBackupRoot = path.resolve(process.env.NEXUS_BACKUP_ROOT || path.join(root, 'backups'));

function sha256(file) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(file));
  return hash.digest('hex');
}

function safeRelative(relative) {
  const normalized = String(relative).replace(/\\/g, '/');
  if (!normalized || normalized.startsWith('/') || normalized.split('/').includes('..')) throw new Error(`UNSAFE_BACKUP_PATH:${relative}`);
  return normalized;
}

function copyTree(source, destination, files, bundleRoot) {
  if (!fs.existsSync(source)) return;
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`SYMLINK_NOT_ALLOWED:${from}`);
    if (entry.isDirectory()) {
      fs.mkdirSync(to, { recursive: true, mode: 0o700 });
      copyTree(from, to, files, bundleRoot);
    } else if (entry.isFile()) {
      fs.mkdirSync(path.dirname(to), { recursive: true, mode: 0o700 });
      fs.copyFileSync(from, to);
      fs.chmodSync(to, 0o600);
      files.push({ path: safeRelative(path.relative(bundleRoot, to)), size: fs.statSync(to).size, sha256: sha256(to) });
    }
  }
}

function verifyDatabase(databaseFile) {
  const db = new Database(databaseFile, { readonly: true, fileMustExist: true });
  try {
    const quickCheck = db.pragma('quick_check', { simple: true });
    const foreignKeyViolations = db.pragma('foreign_key_check');
    const applied = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'").get()
      ? db.prepare('SELECT version,name,checksum FROM schema_migrations ORDER BY version').all()
      : [];
    const expected = migrations.map(({ version, name, checksum }) => ({ version, name, checksum }));
    const migrationsCurrent = JSON.stringify(applied) === JSON.stringify(expected);
    if (quickCheck !== 'ok' || foreignKeyViolations.length || !migrationsCurrent) throw new Error('RESTORED_DATABASE_INVALID');
    return { quickCheck, foreignKeyViolations: 0, migrations: `${applied.length}/${expected.length}` };
  } finally { db.close(); }
}

function verifyBundle(bundle) {
  const manifestPath = path.join(bundle, 'backup-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.formatVersion !== 1 || !Array.isArray(manifest.files)) throw new Error('BACKUP_MANIFEST_INVALID');
  for (const item of manifest.files) {
    const relative = safeRelative(item.path);
    const file = path.resolve(bundle, relative);
    if (!file.startsWith(`${path.resolve(bundle)}${path.sep}`) || !fs.existsSync(file)) throw new Error(`BACKUP_FILE_MISSING:${relative}`);
    if (fs.statSync(file).size !== item.size || sha256(file) !== item.sha256) throw new Error(`BACKUP_FILE_TAMPERED:${relative}`);
  }
  const database = verifyDatabase(path.join(bundle, 'database', 'data.db'));
  return { manifest, database };
}

async function createBundle(destinationArg) {
  if (!fs.existsSync(sourceDatabase)) throw new Error(`DATABASE_NOT_FOUND:${sourceDatabase}`);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const bundle = path.resolve(destinationArg || path.join(defaultBackupRoot, `nexus-recovery-${stamp}`));
  if (fs.existsSync(bundle)) throw new Error(`BACKUP_DESTINATION_EXISTS:${bundle}`);
  fs.mkdirSync(path.join(bundle, 'database'), { recursive: true, mode: 0o700 });
  const source = new Database(sourceDatabase, { readonly: true, fileMustExist: true });
  try { await source.backup(path.join(bundle, 'database', 'data.db')); } finally { source.close(); }
  const files = [];
  const databaseFile = path.join(bundle, 'database', 'data.db');
  fs.chmodSync(databaseFile, 0o600);
  files.push({ path: 'database/data.db', size: fs.statSync(databaseFile).size, sha256: sha256(databaseFile) });
  const roots = [
    ['storage/private', path.resolve(process.env.NEXUS_STORAGE_ROOT || path.join(root, 'storage', 'private'))],
    ['public/uploads', path.resolve(process.env.NEXUS_PUBLIC_UPLOAD_ROOT || path.join(root, 'public', 'uploads'))],
    ['storage/audit-archives', path.resolve(process.env.AUDIT_ARCHIVE_DIR || path.join(root, 'storage', 'audit-archives'))],
  ];
  for (const [name, sourcePath] of roots) copyTree(sourcePath, path.join(bundle, 'assets', name), files, bundle);
  const manifest = {
    formatVersion: 1,
    createdAt: new Date().toISOString(),
    sourceDatabase: path.basename(sourceDatabase),
    files: files.sort((a, b) => a.path.localeCompare(b.path)),
    requiredExternalSecrets: ['JWT_SECRET','AUDIT_INTEGRITY_SECRET','LEDGER_INTEGRITY_SECRET','LICENSE_SIGNING_SECRET','LICENSE_BINDING_SECRET','TRUSTED_PROXY_SHARED_SECRET'],
    note: 'Secrets are intentionally excluded. Restore them from the independent secret manager before validation or startup.',
  };
  fs.writeFileSync(path.join(bundle, 'backup-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  const verified = verifyBundle(bundle);
  console.log(JSON.stringify({ command: 'create', bundle, files: files.length, database: verified.database }, null, 2));
  return bundle;
}

function restoreBundle(bundleArg, targetArg) {
  if (!bundleArg || !targetArg) throw new Error('Usage: backup-maintenance.mjs restore <bundle> <empty-target-directory>');
  const bundle = path.resolve(bundleArg);
  const target = path.resolve(targetArg);
  if (fs.existsSync(target) && fs.readdirSync(target).length) throw new Error(`RESTORE_TARGET_NOT_EMPTY:${target}`);
  fs.mkdirSync(target, { recursive: true, mode: 0o700 });
  const verified = verifyBundle(bundle);
  for (const item of verified.manifest.files) {
    const source = path.join(bundle, safeRelative(item.path));
    const relative = item.path === 'database/data.db' ? 'data.db' : item.path.replace(/^assets\//, '');
    const destination = path.join(target, safeRelative(relative));
    fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
    fs.copyFileSync(source, destination);
    fs.chmodSync(destination, 0o600);
  }
  const database = verifyDatabase(path.join(target, 'data.db'));
  fs.writeFileSync(path.join(target, 'RESTORE_RESULT.json'), `${JSON.stringify({ restoredAt: new Date().toISOString(), sourceBundle: bundle, database }, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ command: 'restore', bundle, target, database }, null, 2));
}

try {
  if (command === 'create') await createBundle(args[0]);
  else if (command === 'verify') console.log(JSON.stringify({ command, bundle: path.resolve(args[0]), ...verifyBundle(path.resolve(args[0])) }, null, 2));
  else if (command === 'restore') restoreBundle(args[0], args[1]);
  else if (command === 'drill') {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-recovery-drill-'));
    const started = Date.now();
    try {
      const bundle = await createBundle(path.join(base, 'bundle'));
      restoreBundle(bundle, path.join(base, 'restored'));
      console.log(JSON.stringify({ command, success: true, elapsedMs: Date.now() - started, recoveryPoint: new Date().toISOString() }, null, 2));
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  } else throw new Error('Usage: backup-maintenance.mjs <create [bundle]|verify <bundle>|restore <bundle> <empty-target>|drill>');
} catch (error) {
  console.error(String(error?.message || error));
  process.exitCode = 1;
}
