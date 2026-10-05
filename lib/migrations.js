import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as legacyCurrentSchema from '../migrations/001-legacy-current-schema.mjs';
import * as relationalIntegrity from '../migrations/002-relational-integrity.mjs';
import * as usersSchemaConvergence from '../migrations/003-users-schema-convergence.mjs';
import * as postAttachments from '../migrations/004-post-attachments.mjs';
import * as siteAnalytics from '../migrations/005-site-analytics.mjs';
import * as productForceDeletion from '../migrations/006-product-force-deletion.mjs';
import * as adminProgramReuse from '../migrations/007-admin-program-reuse.mjs';
import * as analyticsConfidence from '../migrations/008-analytics-confidence.mjs';

const migrationDirectory=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../migrations');
const checksumPattern=/export const checksum = '[a-f0-9]{64}';/;
const checksumPlaceholder=`export const checksum = '${'0'.repeat(64)}';`;

export const migrations=Object.freeze([
  Object.freeze({...legacyCurrentSchema,file:'001-legacy-current-schema.mjs'}),
  Object.freeze({...relationalIntegrity,file:'002-relational-integrity.mjs'}),
  Object.freeze({...usersSchemaConvergence,file:'003-users-schema-convergence.mjs'}),
  Object.freeze({...postAttachments,file:'004-post-attachments.mjs'}),
  Object.freeze({...siteAnalytics,file:'005-site-analytics.mjs'}),
  Object.freeze({...productForceDeletion,file:'006-product-force-deletion.mjs'}),
  Object.freeze({...adminProgramReuse,file:'007-admin-program-reuse.mjs'}),
  Object.freeze({...analyticsConfidence,file:'008-analytics-confidence.mjs'}),
]);

function checksumSource(source){
  if(!checksumPattern.test(source))throw new Error('MIGRATION_CHECKSUM_DECLARATION_INVALID:source');
  return crypto.createHash('sha256').update(source.replace(checksumPattern,checksumPlaceholder)).digest('hex');
}

export function migrationSourceChecksums(source){
  const lfSource=source.replace(/\r\n/g,'\n');
  const crlfSource=lfSource.replace(/\n/g,'\r\n');
  return [...new Set([checksumSource(source),checksumSource(lfSource),checksumSource(crlfSource)])];
}

export function migrationFileChecksum(file){
  const source=fs.readFileSync(path.join(migrationDirectory,file),'utf8');
  try{return checksumSource(source);}
  catch(error){if(String(error?.message||'').startsWith('MIGRATION_CHECKSUM_DECLARATION_INVALID:'))throw new Error(`MIGRATION_CHECKSUM_DECLARATION_INVALID:${file}`);throw error;}
}

function migrationFileChecksums(file){
  const source=fs.readFileSync(path.join(migrationDirectory,file),'utf8');
  try{return migrationSourceChecksums(source);}
  catch(error){if(String(error?.message||'').startsWith('MIGRATION_CHECKSUM_DECLARATION_INVALID:'))throw new Error(`MIGRATION_CHECKSUM_DECLARATION_INVALID:${file}`);throw error;}
}

function validatePlan(plan){
  let previous=0;
  const seenNames=new Set();
  for(const migration of plan){
    if(!Number.isInteger(migration.version)||migration.version!==previous+1)throw new Error(`MIGRATION_VERSION_SEQUENCE_INVALID:${migration.version}`);
    if(!/^[a-z0-9][a-z0-9-]{2,80}$/.test(migration.name)||seenNames.has(migration.name))throw new Error(`MIGRATION_NAME_INVALID:${migration.name}`);
    if(!/^[a-f0-9]{64}$/.test(migration.checksum))throw new Error(`MIGRATION_CHECKSUM_INVALID:${migration.version}`);
    if(typeof migration.up!=='function')throw new Error(`MIGRATION_UP_INVALID:${migration.version}`);
    if(migration.requiresForeignKeysOff!==undefined&&typeof migration.requiresForeignKeysOff!=='boolean')throw new Error(`MIGRATION_FOREIGN_KEY_MODE_INVALID:${migration.version}`);
    previous=migration.version;seenNames.add(migration.name);
  }
}

export function ensureMigrationTable(db){
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    checksum TEXT NOT NULL,
    applied_at INTEGER NOT NULL,
    execution_ms INTEGER NOT NULL CHECK(execution_ms>=0)
  )`);
}

export function verifyMigrations(db,{plan=migrations,verifyFiles=true}={}){
  validatePlan(plan);ensureMigrationTable(db);
  if(verifyFiles)for(const migration of plan){const accepted=migrationFileChecksums(migration.file);if(!accepted.includes(migration.checksum))throw new Error(`MIGRATION_FILE_TAMPERED:${migration.version}`);}
  const applied=db.prepare('SELECT version,name,checksum,applied_at,execution_ms FROM schema_migrations ORDER BY version').all();
  const byVersion=new Map(plan.map(item=>[item.version,item]));
  for(const record of applied){const expected=byVersion.get(record.version);if(!expected)throw new Error(`MIGRATION_UNKNOWN_APPLIED_VERSION:${record.version}`);if(record.name!==expected.name)throw new Error(`MIGRATION_NAME_MISMATCH:${record.version}`);if(record.checksum!==expected.checksum)throw new Error(`MIGRATION_CHECKSUM_MISMATCH:${record.version}`);}
  return {currentVersion:applied.at(-1)?.version||0,latestVersion:plan.at(-1)?.version||0,applied,pending:plan.filter(item=>!applied.some(record=>record.version===item.version)).map(({version,name,checksum})=>({version,name,checksum}))};
}

export function runMigrations(db,{plan=migrations,verifyFiles=true}={}){
  let state=verifyMigrations(db,{plan,verifyFiles});
  for(const migration of plan){
    if(migration.version<=state.currentVersion)continue;
    const foreignKeysOff=migration.requiresForeignKeysOff===true;
    if(foreignKeysOff)db.pragma('foreign_keys=OFF');
    try{db.transaction(()=>{
        const existing=db.prepare('SELECT name,checksum FROM schema_migrations WHERE version=?').get(migration.version);
        if(existing){if(existing.name!==migration.name||existing.checksum!==migration.checksum)throw new Error(`MIGRATION_CONCURRENT_MISMATCH:${migration.version}`);return;}
        const started=Date.now();
        migration.up(db);
        const violations=db.pragma('foreign_key_check');
        if(violations.length){const error=new Error(`MIGRATION_FOREIGN_KEY_VIOLATION:${migration.version}`);error.violations=violations;throw error;}
        db.prepare('INSERT INTO schema_migrations(version,name,checksum,applied_at,execution_ms) VALUES(?,?,?,?,?)').run(migration.version,migration.name,migration.checksum,Date.now(),Math.max(0,Date.now()-started));
      }).immediate();
    }finally{if(foreignKeysOff)db.pragma('foreign_keys=ON');}
    state=verifyMigrations(db,{plan,verifyFiles});
  }
  return state;
}

export function requireCurrentMigrations(db,options={}){
  const historyExists=db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='schema_migrations'").get();
  if(!historyExists){const plan=options.plan||migrations;throw new Error(`MIGRATIONS_PENDING:${plan.map(item=>item.version).join(',')}`);}
  const state=verifyMigrations(db,options);
  if(state.pending.length)throw new Error(`MIGRATIONS_PENDING:${state.pending.map(item=>item.version).join(',')}`);
  return state;
}
