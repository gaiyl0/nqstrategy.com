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
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

if(process.env.NODE_ENV==='production'&&process.env.NEXUS_AUTO_MIGRATE!=='1')requireCurrentMigrations(db);
else runMigrations(db);

export default db;
