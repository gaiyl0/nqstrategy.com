import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import {migrations,runMigrations} from '../lib/migrations.js';

const remove=base=>{for(const suffix of ['', '-wal', '-shm']){try{fs.rmSync(`${base}${suffix}`);}catch{}}};
const connect=file=>{const db=new Database(file);db.function('audit_maintenance_allowed',()=>0);db.function('wallet_maintenance_allowed',()=>0);db.pragma('foreign_keys=ON');return db;};
let assertions=0;
const equal=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);assertions+=1;};
const throws=(callback,pattern,message)=>{assert.throws(callback,pattern,message);assertions+=1;};

const freshPath=path.resolve('.tmp-schema-convergence-fresh.db');remove(freshPath);
const fresh=connect(freshPath);runMigrations(fresh);
const columns=new Map(fresh.pragma('table_info(users)').map(column=>[column.name,column]));
equal(columns.get('email').notnull,1,'email is required');
equal(columns.get('password').notnull,1,'password is required');
equal(columns.get('role').notnull,1,'role is required');
equal(columns.get('role').dflt_value,"'user'",'role defaults to user');
equal(columns.get('balance').notnull,1,'balance is required');
equal(columns.has('sms_verified'),false,'obsolete sms verification column is removed');
throws(()=>fresh.prepare("INSERT INTO users(username,email,password,role) VALUES('bad-role','bad-role@test','hash','owner')").run(),/CHECK constraint/,'unknown roles are rejected');
throws(()=>fresh.prepare("INSERT INTO users(username,email,password) VALUES('blank-email','','hash')").run(),/CHECK constraint/,'blank email is rejected');
fresh.close();remove(freshPath);

const legacyPath=path.resolve('.tmp-schema-convergence-legacy.db');remove(legacyPath);
const legacy=connect(legacyPath);
legacy.exec(`CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, email TEXT,
  role TEXT DEFAULT 'standard', email_verified BOOLEAN DEFAULT 0, sms_verified BOOLEAN DEFAULT 0,
  join_date DATETIME DEFAULT CURRENT_TIMESTAMP, password TEXT, avatar_url TEXT, balance REAL DEFAULT 0
)`);
const preservedPassword=`scrypt$${'a'.repeat(32)}$${'b'.repeat(128)}`;
legacy.prepare("INSERT INTO users(id,username,email,role,email_verified,sms_verified,password,avatar_url,balance) VALUES(17,'LegacyUser','Legacy@Test.Invalid','standard',1,1,?,'/avatar.png',12.34)").run(preservedPassword);
runMigrations(legacy,{plan:migrations.slice(0,2)});
runMigrations(legacy);
const preserved=legacy.prepare('SELECT * FROM users WHERE id=17').get();
equal(preserved.username,'LegacyUser','username is preserved');
equal(preserved.email,'Legacy@Test.Invalid','email is preserved');
equal(preserved.password,preservedPassword,'password digest is preserved');
equal(preserved.role,'user','legacy standard role remains normalized');
equal(preserved.balance,12.34,'balance is preserved');
equal(preserved.avatar_url,'/avatar.png','profile data is preserved');
equal(legacy.pragma('foreign_key_check').length,0,'legacy upgrade has no foreign key violations');
throws(()=>legacy.prepare("INSERT INTO users(username,email,password,role) VALUES('case-user','legacy@test.invalid','hash','user')").run(),/UNIQUE constraint/,'case-insensitive email uniqueness is enforced');
legacy.close();remove(legacyPath);

const invalidPath=path.resolve('.tmp-schema-convergence-invalid.db');remove(invalidPath);
const invalid=connect(invalidPath);runMigrations(invalid,{plan:migrations.slice(0,2)});
invalid.prepare("INSERT INTO users(username,email,password,role) VALUES('invalid','invalid@test','hash','owner')").run();
throws(()=>runMigrations(invalid),/USERS_ROLE_INVALID:1/,'invalid legacy role fails closed');
equal(invalid.prepare('SELECT MAX(version) version FROM schema_migrations').get().version,2,'failed convergence is not recorded');
equal(invalid.prepare("SELECT role FROM users WHERE username='invalid'").get().role,'owner','failed convergence does not rewrite invalid data');
invalid.close();remove(invalidPath);

console.log(`Schema convergence tests passed: ${assertions} assertions`);
