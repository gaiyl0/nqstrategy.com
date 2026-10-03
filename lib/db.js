import Database from 'better-sqlite3';
import path from 'path';
import { requireCurrentMigrations, runMigrations } from './migrations.js';

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
// Two fresh server workers can race to enable WAL before migrations take their
// transaction lock. Retry only this transient startup lock, with a fixed limit.
const walDeadline = Date.now() + 5000;
const walRetrySignal = new Int32Array(new SharedArrayBuffer(4));
while (true) {
  try {
    db.pragma('journal_mode = WAL');
    break;
  } catch (error) {
    if (error.code !== 'SQLITE_BUSY' || Date.now() >= walDeadline) throw error;
    Atomics.wait(walRetrySignal, 0, 0, 50);
  }
}
db.pragma('foreign_keys = ON');

const isProduction=process.env.NODE_ENV==='production';
const migrationOptions={verifyFiles:!isProduction};

// Next.js bundles the migration manifest into the server output. Production
// verifies that the database history matches that immutable manifest; the CLI
// remains responsible for hashing the migration source files before deploy.
if(isProduction&&process.env.NEXUS_AUTO_MIGRATE!=='1')requireCurrentMigrations(db,migrationOptions);
else runMigrations(db,migrationOptions);

export default db;
