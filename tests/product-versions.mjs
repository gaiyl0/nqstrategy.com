import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'nq-versions-'));process.env.NODE_ENV='test';process.env.NEXUS_DB_PATH=path.join(root,'data.db');
let db;
try{
  ({default:db}=await import('../lib/db.js'));
  const versions=await import('../lib/product-versions.js');
  const now=Date.now();
  const admin=Number(db.prepare("INSERT INTO users(username,email,password,role) VALUES('admin','admin@test','x','admin')").run().lastInsertRowid);
  const owner=Number(db.prepare("INSERT INTO users(username,email,password,role) VALUES('owner','owner@test','x','developer')").run().lastInsertRowid);
  const buyerOld=Number(db.prepare("INSERT INTO users(username,email,password,role) VALUES('old','old@test','x','user')").run().lastInsertRowid);
  const buyerNew=Number(db.prepare("INSERT INTO users(username,email,password,role) VALUES('new','new@test','x','user')").run().lastInsertRowid);
  const product=Number(db.prepare("INSERT INTO products(title,author,author_user_id,status,price) VALUES('EA','owner',?,'active',0)").run(owner).lastInsertRowid);
  const addUpload=(suffix)=>{const url=`/private/eas/${suffix}.ex5`;const id=Number(db.prepare("INSERT INTO uploads(owner_user_id,url,kind,original_name,size,stored_name,content_sha256,status,expires_at) VALUES(?,?,'ea',?,100,?,?, 'content_validated',?)").run(owner,url,`${suffix}.ex5`,`${suffix}.ex5`,suffix.repeat(64).slice(0,64),now+10000).lastInsertRowid);return {id,url,content_sha256:suffix.repeat(64).slice(0,64)};};
  const initial=addUpload('a');
  const first=versions.submitVersion(product,owner,initial,{version:'1.0.0',releaseNotes:'Initial release',upgradePolicy:'all_existing'});
  assert.equal(first.status,'pending');
  const published=versions.reviewVersion(first.id,'approve','',admin);assert.equal(published.isCurrent,true);
  assert.equal(versions.reviewVersion(first.id,'approve','',admin).replayed,true);
  assert.throws(()=>db.prepare("UPDATE product_versions SET version='9.9.9' WHERE id=?").run(first.id),/PRODUCT_VERSION_IMMUTABLE/);
  assert.throws(()=>versions.submitVersion(product,owner,addUpload('b'),{version:'1.0.0',releaseNotes:'Duplicate',upgradePolicy:'all_existing'}),/UNIQUE/);

  db.prepare("INSERT INTO orders(username,buyer_user_id,product_id,price,status,tx_hash,payment_verified,created_at) VALUES('old',?, ?,0,'completed','OLD',1,datetime('now','-1 day'))").run(buyerOld,product);
  const second=versions.submitVersion(product,owner,addUpload('c'),{version:'2.0.0',releaseNotes:'Paid major upgrade',upgradePolicy:'new_purchases_only'});
  const current=versions.reviewVersion(second.id,'approve','',admin);assert.equal(current.version,'2.0.0');assert.equal(versions.getCurrentVersion(product).version,'2.0.0');
  assert.equal(versions.findEligibleOrder(buyerOld,db.prepare('SELECT * FROM product_versions WHERE id=?').get(second.id)),undefined);
  db.prepare("INSERT INTO orders(username,buyer_user_id,product_id,price,status,tx_hash,payment_verified,created_at) VALUES('new',?, ?,0,'completed','NEW',1,datetime('now','+1 day'))").run(buyerNew,product);
  assert.ok(versions.findEligibleOrder(buyerNew,db.prepare('SELECT * FROM product_versions WHERE id=?').get(second.id)));
  assert.ok(versions.findEligibleOrder(buyerOld,db.prepare('SELECT * FROM product_versions WHERE id=?').get(first.id)),'old owner keeps access to inherited historical version');
  const oldEligible=versions.listEligibleVersions(product,"2026-09-01T00:00:00.000Z");assert.deepEqual(oldEligible.map(item=>item.version),['1.0.0']);
  versions.recordVersionDownload(db.prepare('SELECT * FROM product_versions WHERE id=?').get(first.id),buyerOld,1);
  assert.equal(db.prepare('SELECT COUNT(*) count FROM product_version_downloads').get().count,1);

  const rejected=versions.submitVersion(product,owner,addUpload('d'),{version:'2.1.0',releaseNotes:'Rejected build',upgradePolicy:'all_existing'});
  assert.equal(versions.reviewVersion(rejected.id,'reject','恶意扫描需要复核',admin).status,'rejected');
  assert.equal(versions.getCurrentVersion(product).version,'2.0.0');
  assert.equal(versions.reviewVersion(second.id,'retire','发现版本兼容性问题',admin).status,'retired');
  assert.equal(versions.getCurrentVersion(product).version,'1.0.0','retiring current version must atomically fall back');
  assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
  console.log(JSON.stringify({success:true,assertions:17}));
}finally{db?.close();fs.rmSync(root,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
