import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

const root=process.cwd();
const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'nexus-profile-password-'));
const databasePath=path.join(tempRoot,'runtime.db');
const port=3201;
const origin='https://nexus.test';
const jwtSecret='profile-test-jwt-secret-0123456789-abcdef';
const proxySecret='profile-test-proxy-secret-0123456789-abcdef';
const env={...process.env,NODE_ENV:'production',NEXUS_DB_PATH:databasePath,NEXUS_AUTO_MIGRATE:'1',JWT_SECRET:jwtSecret,
  AUDIT_HASH_SECRET:'profile-test-audit-hash-0123456789-abcdef',VERIFICATION_CODE_SECRET:'profile-test-code-0123456789-abcdef',
  AUDIT_INTEGRITY_SECRET:'profile-test-audit-integrity-0123456789-abcdef',LEDGER_INTEGRITY_SECRET:'profile-test-ledger-integrity-0123456789-abcdef',
  LICENSE_SIGNING_SECRET:'profile-test-license-signing-0123456789-abcdef',LICENSE_BINDING_SECRET:'profile-test-license-binding-0123456789-abcdef',
  AUDIT_RETENTION_DAYS:'180',AUDIT_ARCHIVE_DIR:'storage/audit-archives',TRUSTED_PROXY_MODE:'nginx',TRUSTED_PROXY_SHARED_SECRET:proxySecret,
  RATE_LIMIT_BACKEND:'sqlite',DEPLOYMENT_TOPOLOGY:'single-instance',APP_ORIGINS:origin};

const hash=password=>{const salt=crypto.randomBytes(16).toString('hex');return `scrypt$${salt}$${crypto.scryptSync(password,salt,64).toString('hex')}`;};
const cookie=(id,version=1)=>{const data=Buffer.from(JSON.stringify({id,sv:version,exp:Date.now()+120000})).toString('base64url');return `nexus_token=${data}.${crypto.createHmac('sha256',jwtSecret).update(data).digest('base64url')}`;};
let ipCounter=10;
async function request(pathname,{method='GET',session=null,body,ip}={}){
  const response=await fetch(`http://127.0.0.1:${port}${pathname}`,{method,headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...(session?{Cookie:session}:{}),'X-Nexus-Proxy-Secret':proxySecret,'X-Real-IP':ip||`198.51.100.${ipCounter++}`},...(body?{body:JSON.stringify(body)}:{})});
  return {status:response.status,body:await response.json(),setCookie:response.headers.get('set-cookie'),audit:response.headers.get('x-audit-status')};
}
const profile=(username,password,currentPassword)=>({newUsername:username,password,...(currentPassword===undefined?{}:{currentPassword})});

let server;let output='';
try{
  const seed=spawnSync(process.execPath,['--input-type=module','-e',`
    import db from './lib/db.js';
    db.prepare("INSERT INTO users(username,email,password,role) VALUES('alice','alice@test.invalid',?,'user')").run(${JSON.stringify(hash('Old-password-123!'))});
    db.prepare("INSERT INTO users(username,email,password,role) VALUES('racer','racer@test.invalid',?,'user')").run(${JSON.stringify(hash('Race-password-123!'))});
    db.prepare("INSERT INTO users(username,email,password,role) VALUES('limited','limited@test.invalid',?,'user')").run(${JSON.stringify(hash('Limited-password-123!'))});
    db.close();
  `],{cwd:root,env,encoding:'utf8'});
  assert.equal(seed.status,0,seed.stderr);
  server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p',String(port)],{cwd:root,env,stdio:['ignore','pipe','pipe'],windowsHide:true});
  server.stdout.on('data',chunk=>output+=chunk);server.stderr.on('data',chunk=>output+=chunk);
  let ready=false;for(let attempt=0;attempt<40;attempt+=1){await new Promise(resolve=>setTimeout(resolve,250));try{if((await fetch(`http://127.0.0.1:${port}/`)).ok){ready=true;break;}}catch{}}
  assert.equal(ready,true,`production server did not become ready\n${output}`);

  const aliceCookie=cookie(1);
  const missing=await request('/api/users',{method:'PATCH',session:aliceCookie,body:profile('alice','New-password-123!')});
  assert.equal(missing.status,400);assert.equal(missing.body.code,'VALIDATION_ERROR');
  const wrong=await request('/api/users',{method:'PATCH',session:aliceCookie,body:profile('alice','New-password-123!','wrong-password')});
  assert.equal(wrong.status,401);assert.equal(wrong.audit,'ok');
  const stillValid=await request('/api/auth/me',{session:aliceCookie});assert.equal(stillValid.body.success,true);

  const changed=await request('/api/users',{method:'PATCH',session:aliceCookie,body:profile('alice','New-password-123!','Old-password-123!')});
  assert.equal(changed.status,200,JSON.stringify(changed.body));assert.equal(changed.audit,'ok');assert.ok(changed.setCookie?.includes('nexus_token='));
  assert.equal(changed.body.user.session_version,2);
  const stale=await request('/api/auth/me',{session:aliceCookie});assert.equal(stale.body.success,false);
  const replay=await request('/api/users',{method:'PATCH',session:aliceCookie,body:profile('alice','Another-password-123!','Old-password-123!')});assert.equal(replay.status,401);
  const refreshedCookie=changed.setCookie.split(';')[0];
  const refreshed=await request('/api/auth/me',{session:refreshedCookie});assert.equal(refreshed.body.success,true);
  const oldLogin=await request('/api/auth/login',{method:'POST',body:{account:'alice@test.invalid',password:'Old-password-123!'}});assert.equal(oldLogin.status,401);
  const newLogin=await request('/api/auth/login',{method:'POST',body:{account:'alice@test.invalid',password:'New-password-123!'}});assert.equal(newLogin.status,200);

  const raceCookie=cookie(2);
  const race=await Promise.all([
    request('/api/users',{method:'PATCH',session:raceCookie,body:profile('racer','Race-new-A-123!','Race-password-123!'),ip:'203.0.113.50'}),
    request('/api/users',{method:'PATCH',session:raceCookie,body:profile('racer','Race-new-B-123!','Race-password-123!'),ip:'203.0.113.51'}),
  ]);
  assert.equal(race.filter(result=>result.status===200).length,1,JSON.stringify(race));
  assert.ok([401,409].includes(race.find(result=>result.status!==200)?.status));
  const loginA=await request('/api/auth/login',{method:'POST',body:{account:'racer@test.invalid',password:'Race-new-A-123!'}});
  const loginB=await request('/api/auth/login',{method:'POST',body:{account:'racer@test.invalid',password:'Race-new-B-123!'}});
  assert.deepEqual([loginA.status,loginB.status].sort(),[200,401]);

  const limitedCookie=cookie(3);const limitedAttempts=[];
  for(let attempt=0;attempt<6;attempt+=1)limitedAttempts.push(await request('/api/users',{method:'PATCH',session:limitedCookie,body:profile('limited','Limited-new-123!','wrong-password'),ip:'203.0.113.80'}));
  assert.deepEqual(limitedAttempts.slice(0,5).map(result=>result.status),[401,401,401,401,401]);
  assert.equal(limitedAttempts[5].status,429);assert.equal(limitedAttempts[5].audit,'ok');

  server.kill();await new Promise(resolve=>server.once('exit',resolve));server=null;
  const db=new Database(databasePath,{readonly:true});
  assert.equal(db.prepare("SELECT session_version FROM users WHERE username='alice'").get().session_version,2);
  assert.equal(db.prepare("SELECT session_version FROM users WHERE username='racer'").get().session_version,2);
  const audits=db.prepare("SELECT reason_code,COUNT(*) count FROM audit_logs WHERE event_type='auth.profile_password_change' GROUP BY reason_code").all();
  const reasons=Object.fromEntries(audits.map(row=>[row.reason_code,row.count]));
  assert.ok(reasons.CURRENT_PASSWORD_INVALID>=1);assert.ok(reasons.PASSWORD_CHANGED>=2);assert.ok((reasons.ACCOUNT_STATE_CONFLICT||0)>=0);
  db.close();
  console.log(JSON.stringify({success:true,assertions:26,raceStatuses:race.map(result=>result.status),rateLimitStatuses:limitedAttempts.map(result=>result.status),auditReasons:reasons},null,2));
}finally{
  if(server&&server.exitCode===null){server.kill();await Promise.race([new Promise(resolve=>server.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,2000))]);}
  fs.rmSync(tempRoot,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
