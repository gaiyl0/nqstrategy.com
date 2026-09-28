import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const testDir=fs.mkdtempSync(path.join(os.tmpdir(),'nq-verification-'));
process.env.NEXUS_DB_PATH=path.join(testDir,'test.db');
const { default:db }=await import('../lib/db.js');
const { approveVerification,getVerification,getVerificationHistory,revokeVerification,syncAutomaticVerification }=await import('../lib/strategy-verification.js');
const { verificationReviewSchema }=await import('../lib/validation.js');

const now=Date.now();
const admin=db.prepare("INSERT INTO users(username,email,password,role) VALUES('admin','admin@test.local','x','admin')").run().lastInsertRowid;
const developer=db.prepare("INSERT INTO users(username,email,password,role) VALUES('dev','dev@test.local','x','developer')").run().lastInsertRowid;
const product=db.prepare("INSERT INTO products(title,description,price,author,author_user_id,status) VALUES('Verified EA','test',99,'dev',?,'active')").run(developer).lastInsertRowid;

assert.equal(getVerification(product).level,'unverified');
assert.equal(syncAutomaticVerification(product,admin).level,'unverified');

for(const [index,type] of ['settings','statistics','chart'].entries()) db.prepare("INSERT INTO strategy_evidence(product_id,owner_user_id,evidence_type,original_name,original_stored_name,preview_stored_name,content_sha256,mime_type,size,extraction_status,review_status,uploaded_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run(product,developer,type,`${type}.png`,`original-${index}.png`,`preview-${index}.png`,String(index).repeat(64),'image/png',10,'manual_review','approved',now);
assert.equal(syncAutomaticVerification(product,admin).level,'screenshot_reviewed');

db.prepare("INSERT INTO strategy_reports(product_id,owner_user_id,original_name,stored_name,content_sha256,size,parser_version,extracted_json,uploaded_at) VALUES(?,?,?,?,?,?,?,?,?)").run(product,developer,'report.htm','report.htm','b'.repeat(64),100,1,'{}',now);
assert.equal(syncAutomaticVerification(product,admin).level,'report_verified');

const reproducible={parameterFileSha256:'c'.repeat(64),dataset:'Every tick based on real ticks',terminalBuild:'MT5 build 5320',testRange:'2026-01-01/2026-09-01'};
assert.equal(approveVerification(product,'reproducible_backtest',reproducible,admin).level,'reproducible_backtest');
assert.equal(syncAutomaticVerification(product,admin).level,'reproducible_backtest','automatic sync must preserve a higher manual level');

const live={provider:'MetaQuotes Signals',accountMasked:'12****89',accessMode:'read_only',observedDays:90,lastCheckedDate:'2026-09-27',maxDrawdownPercent:12.3};
assert.equal(approveVerification(product,'live_verified',live,admin).level,'live_verified');
db.prepare('UPDATE strategy_verifications SET expires_at=? WHERE product_id=?').run(Date.now()-1,product);
const expired=getVerification(product,{includePrivate:true});
assert.equal(expired.level,'unverified');
assert.equal(expired.recordedLevel,'live_verified');
assert.equal(expired.expired,true);
assert.equal(syncAutomaticVerification(product,admin).level,'report_verified','expired manual verification must fall back to the evidence-derived level');

assert.equal(revokeVerification(product,'发现材料已失效',admin).level,'unverified');
assert.ok(getVerificationHistory(product).length>=6);

assert.equal(verificationReviewSchema.safeParse({action:'approve',productId:Number(product),level:'live_verified',evidence:live}).success,true);
assert.equal(verificationReviewSchema.safeParse({action:'approve',productId:Number(product),level:'live_verified',evidence:{...live,observedDays:3}}).success,false);
assert.equal(verificationReviewSchema.safeParse({action:'approve',productId:Number(product),level:'reproducible_backtest',evidence:{...reproducible,parameterFileSha256:'bad'}}).success,false);
assert.equal(verificationReviewSchema.safeParse({action:'revoke',productId:Number(product),reason:'短'}).success,false);

db.close();
fs.rmSync(testDir,{recursive:true,force:true});
console.log('strategy verification tests passed');
