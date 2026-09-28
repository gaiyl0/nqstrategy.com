import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import {migrationFileChecksum,runMigrations,verifyMigrations} from '../lib/migrations.js';

const command=process.argv[2]||'status';
if(command==='checksum'){
  const file=path.basename(process.argv[3]||'');
  if(!/^\d{3}-[a-z0-9-]+\.mjs$/.test(file)){console.error('Usage: npm run db:migrate -- checksum migrations/NNN-name.mjs');process.exit(2);}
  console.log(migrationFileChecksum(file));process.exit(0);
}
if(!['status','verify','up'].includes(command)){console.error('Usage: npm run db:migrate -- <status|verify|up|checksum>');process.exit(2);}
const databasePath=path.resolve(process.env.NEXUS_DB_PATH||'data.db');
fs.mkdirSync(path.dirname(databasePath),{recursive:true});
const existed=fs.existsSync(databasePath);
const db=new Database(databasePath);
db.function('audit_maintenance_allowed',()=>0);db.function('wallet_maintenance_allowed',()=>0);
db.pragma('journal_mode = WAL');db.pragma('foreign_keys = ON');
try{
  const before=verifyMigrations(db);
  if(command==='up'&&before.pending.length){
    if(existed){const directory=path.resolve('backups');fs.mkdirSync(directory,{recursive:true});const stamp=new Date().toISOString().replace(/[:.]/g,'-');const backup=path.join(directory,`${path.basename(databasePath)}-before-migration-v${before.pending[0].version}-${stamp}.db`);await db.backup(backup);console.log(`backup=${backup}`);}
    const after=runMigrations(db);console.log(`applied=${after.currentVersion-before.currentVersion}`);console.log(`current=${after.currentVersion}/${after.latestVersion}`);
  }else{
    const state=verifyMigrations(db);console.log(`current=${state.currentVersion}/${state.latestVersion}`);console.log(`pending=${state.pending.map(item=>item.version).join(',')||'none'}`);if(command==='verify'){console.log(`quick_check=${db.pragma('quick_check',{simple:true})}`);console.log(`foreign_key_violations=${db.pragma('foreign_key_check').length}`);}
  }
}catch(error){console.error(error.message);process.exitCode=1;}finally{db.close();}
