import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const dbPath=path.resolve('.tmp-product-slug-test.db');
for(const suffix of ['', '-wal', '-shm']){try{fs.rmSync(`${dbPath}${suffix}`);}catch{}}
process.env.NEXUS_DB_PATH=dbPath;
const {productSlug,slugBase,validProductSlug}=await import('../lib/product-slug.mjs');
const {default:db}=await import('../lib/db.js');
const {getPublicProductBySlug}=await import('../lib/public-product.js');
let assertions=0;const equal=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);assertions+=1;};

equal(slugBase('  TianWei V1.46 / 黄金策略  '),'tianwei-v1-46-黄金策略','titles normalize to a readable slug base');
equal(productSlug('Alpha EA',12),'alpha-ea-12','stable id suffix prevents title collisions');
equal(validProductSlug('alpha-ea-12'),true,'valid slug is accepted');
equal(validProductSlug('../alpha'),false,'path traversal is rejected');

const user=Number(db.prepare("INSERT INTO users(username,email,role,password) VALUES('slug-dev','slug@example.com','developer','hash')").run().lastInsertRowid);
const insert=db.prepare("INSERT INTO products(title,author,author_user_id,price,status,moderation_status) VALUES(?,'slug-dev',?,0,?,?)");
const active=Number(insert.run('Public Strategy',user,'active','visible').lastInsertRowid);
const pending=Number(insert.run('Pending Strategy',user,'pending','visible').lastInsertRowid);
const hidden=Number(insert.run('Hidden Strategy',user,'active','hidden').lastInsertRowid);
for(const row of db.prepare("SELECT id,title FROM products WHERE slug IS NULL").all())db.prepare('UPDATE products SET slug=? WHERE id=?').run(productSlug(row.title,row.id),row.id);
const activeSlug=db.prepare('SELECT slug FROM products WHERE id=?').get(active).slug;
equal(getPublicProductBySlug(activeSlug).id,active,'active visible product resolves by slug');
equal(getPublicProductBySlug(db.prepare('SELECT slug FROM products WHERE id=?').get(pending).slug),null,'pending product is not public');
equal(getPublicProductBySlug(db.prepare('SELECT slug FROM products WHERE id=?').get(hidden).slug),null,'moderated product is not public');
db.prepare("UPDATE products SET title='Renamed Strategy' WHERE id=?").run(active);
equal(db.prepare('SELECT slug FROM products WHERE id=?').get(active).slug,activeSlug,'editing title does not break existing links');
assert.throws(()=>db.prepare('UPDATE products SET slug=? WHERE id=?').run(activeSlug,pending),/UNIQUE/);assertions+=1;

db.close();for(const suffix of ['', '-wal', '-shm']){try{fs.rmSync(`${dbPath}${suffix}`);}catch{}}
console.log(`Product slug tests passed: ${assertions} assertions`);
