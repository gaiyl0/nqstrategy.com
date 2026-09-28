import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

if(process.argv[2]==='--worker'){
  const {default:db}=await import('../lib/db.js');
  db.close();process.exit(0);
}

const remove=(base)=>{for(const suffix of ['', '-wal', '-shm']){try{fs.rmSync(`${base}${suffix}`);}catch{}}};
const testPath=path.resolve('.tmp-database-migrations-test.db');remove(testPath);
const {runMigrations,verifyMigrations}=await import('../lib/migrations.js');
const db=new Database(testPath);db.pragma('foreign_keys=ON');
let assertions=0;const equal=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);assertions+=1;};
const migration1={version:1,name:'test-create-stable',checksum:'1'.repeat(64),up(database){database.exec('CREATE TABLE stable(id INTEGER PRIMARY KEY,value TEXT); INSERT INTO stable(value) VALUES (\'kept\')');}};
const failing2={version:2,name:'test-failure-rollback',checksum:'2'.repeat(64),up(database){database.exec('CREATE TABLE should_rollback(id INTEGER)');throw new Error('EXPECTED_MIGRATION_FAILURE');}};
assert.throws(()=>runMigrations(db,{plan:[migration1,failing2],verifyFiles:false}),/EXPECTED_MIGRATION_FAILURE/);assertions+=1;
equal(db.prepare('SELECT COUNT(*) count FROM schema_migrations').get().count,1,'completed migration remains recorded');
equal(db.prepare("SELECT COUNT(*) count FROM sqlite_master WHERE type='table' AND name='should_rollback'").get().count,0,'failed migration schema is rolled back');
equal(db.prepare('SELECT value FROM stable').get().value,'kept','earlier committed migration remains intact');
const migration2={...failing2,checksum:'3'.repeat(64),up(database){database.exec('CREATE TABLE recovered(id INTEGER PRIMARY KEY)');}};
equal(runMigrations(db,{plan:[migration1,migration2],verifyFiles:false}).currentVersion,2,'corrected next migration applies');
equal(runMigrations(db,{plan:[migration1,migration2],verifyFiles:false}).pending.length,0,'second startup is idempotent');
equal(db.prepare('SELECT COUNT(*) count FROM schema_migrations').get().count,2,'idempotent startup does not duplicate history');
db.prepare("UPDATE schema_migrations SET checksum='bad' WHERE version=2").run();
assert.throws(()=>verifyMigrations(db,{plan:[migration1,migration2],verifyFiles:false}),/MIGRATION_CHECKSUM_MISMATCH/);assertions+=1;
db.prepare('UPDATE schema_migrations SET checksum=? WHERE version=2').run(migration2.checksum);
db.prepare("INSERT INTO schema_migrations(version,name,checksum,applied_at,execution_ms) VALUES(99,'unknown-version',?,0,0)").run('9'.repeat(64));
assert.throws(()=>verifyMigrations(db,{plan:[migration1,migration2],verifyFiles:false}),/MIGRATION_UNKNOWN_APPLIED_VERSION/);assertions+=1;
db.close();remove(testPath);

const concurrentPath=path.resolve('.tmp-database-migrations-concurrent.db');remove(concurrentPath);
const worker=()=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,[path.resolve('tests/database-migrations.mjs'),'--worker'],{cwd:process.cwd(),env:{...process.env,NEXUS_DB_PATH:concurrentPath,NODE_ENV:'development'},stdio:['ignore','pipe','pipe']});let stderr='';child.stderr.on('data',chunk=>stderr+=chunk);child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`worker exit ${code}: ${stderr}`)));});
await Promise.all([worker(),worker()]);
const concurrent=new Database(concurrentPath,{readonly:true});
equal(concurrent.prepare('SELECT COUNT(*) count FROM schema_migrations').get().count,2,'concurrent startup records each migration once');
equal(concurrent.prepare('SELECT MAX(version) version FROM schema_migrations').get().version,2,'concurrent startup reaches latest migration');
equal(concurrent.pragma('quick_check',{simple:true}),'ok','concurrent migrated database is healthy');
concurrent.close();remove(concurrentPath);
console.log(`Database migration tests passed: ${assertions} assertions`);
