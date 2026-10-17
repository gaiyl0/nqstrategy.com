import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import Database from 'better-sqlite3';

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nq-engagement-http-')),port=3244,origin='https://nexus.test';
const jwt='engagement-test-jwt-01234567890123456789',proxy='engagement-test-proxy-01234567890123456789';
const env={...process.env,NODE_ENV:'production',NEXUS_DB_PATH:path.join(directory,'data.db'),NEXUS_AUTO_MIGRATE:'1',JWT_SECRET:jwt,VERIFICATION_CODE_SECRET:jwt,AUDIT_HASH_SECRET:jwt,AUDIT_INTEGRITY_SECRET:jwt,LEDGER_INTEGRITY_SECRET:jwt,LICENSE_SIGNING_SECRET:jwt,LICENSE_BINDING_SECRET:jwt,TRUSTED_PROXY_MODE:'nginx',TRUSTED_PROXY_SHARED_SECRET:proxy,RATE_LIMIT_BACKEND:'sqlite',DEPLOYMENT_TOPOLOGY:'single-instance',AUDIT_RETENTION_DAYS:'180',APP_ORIGINS:origin,NEXT_PUBLIC_SITE_URL:origin};
const cookie=id=>{const payload=Buffer.from(JSON.stringify({id,sv:1,exp:Date.now()+3600000})).toString('base64url');return `nexus_token=${payload}.${crypto.createHmac('sha256',jwt).update(payload).digest('base64url')}`;};
let server,db,output='',count=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);count++;},ok=(value,label)=>{assert.ok(value,label);count++;};
async function request(url,{id,body,method=body?'POST':'GET',device='',headers={},native=false,ip='198.51.100.44'}={}){
  const response=await fetch(`http://127.0.0.1:${port}${url}`,{method,headers:{...(!native?{Origin:origin}:{}),'X-Nexus-Proxy-Secret':proxy,'X-Real-IP':ip,...(id||device?{Cookie:[id?cookie(id):'',device].filter(Boolean).join('; ')}:{}),...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
  return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie'),cache:response.headers.get('cache-control'),audit:response.headers.get('x-audit-status')};
}
try {
  const seed=spawnSync(process.execPath,['--input-type=module','-e',`
    import db from './lib/db.js';import {issueVerificationCode} from './lib/verification-codes.js';
    db.prepare("INSERT INTO users(id,username,email,password,role,email_verified,join_date) VALUES(1,'owner','owner@example.test','hash','admin',1,'2026-01-01 00:00:00'),(2,'member','member@example.test','hash','user',1,'2026-01-01 00:00:00'),(3,'otheradmin','admin@example.test','hash','admin',1,'2026-01-01 00:00:00'),(4,'creator','creator@example.test','hash','developer',1,'2026-01-01 00:00:00')").run();
    db.prepare('INSERT INTO system_owners(user_id,created_at) VALUES(1,?)').run(Date.now());
    db.prepare("INSERT INTO products(id,title,author,author_user_id,status,price) VALUES(1,'HTTP EA','creator',4,'active',200)").run();
    db.prepare("INSERT INTO orders(id,username,buyer_user_id,product_id,price,status,tx_hash,payment_verified) VALUES(1,'member',2,1,0,'completed','POINTS:engagement-http',1)").run();
    db.prepare("INSERT INTO product_licenses(id,user_id,product_id,source_order_id,license_type,status,starts_at,created_at) VALUES(1,2,1,1,'free','active',?,?)").run(Date.now()-1000,Date.now()-1000);
    console.log(JSON.stringify({registrationCode:issueVerificationCode('invited@example.test','register').code}));db.close();
  `],{env,encoding:'utf8',windowsHide:true});
  eq(seed.status,0,seed.stderr);const registrationCode=JSON.parse(seed.stdout.trim()).registrationCode;
  db=new Database(env.NEXUS_DB_PATH);db.pragma('journal_mode=WAL');
  server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p',String(port)],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',chunk=>output+=chunk);server.stderr.on('data',chunk=>output+=chunk);
  let ready=false;for(let i=0;i<80;i++){await new Promise(resolve=>setTimeout(resolve,500));try{if((await request('/api/referrals?view=identity')).status===200){ready=true;break;}}catch{}}
  ok(ready,output);
  for(const name of ['NexusRuntime.mqh','NexusAccountReporter.mq5','NexusAccountReporter.ex5','NexusAuthorizationExample.mq5']){
    const file=await fetch(`http://127.0.0.1:${port}/ea-integration/${name}`);eq(file.status,200);ok((await file.arrayBuffer()).byteLength>500);
  }
  eq((await request('/api/referrals')).status,401);eq((await request('/api/points/gifts')).status,401);
  eq((await request('/api/points/gifts',{id:2})).status,403);
  eq((await request('/api/runtime-authorizations?scope=admin',{id:3})).status,403,'ordinary admin cannot use system-owner authorization workspace');
  eq((await request('/api/runtime-authorizations?scope=admin',{id:1})).status,200);
  eq((await request('/api/users',{id:3,method:'PATCH',body:{id:1,newRole:'user'}})).status,403,'another administrator cannot demote the system owner');
  eq((await request('/api/users',{id:3,method:'PATCH',body:{id:1,newPassword:'Attempted-password-123!'}})).status,403,'another administrator cannot reset the system owner password');
  const giftBody={userId:2,points:200,reason:'管理员活动赠送',requestKey:'http-gift-request-000001'};
  eq((await request('/api/points/gifts',{id:1,body:giftBody,headers:{Origin:'https://attacker.test'}})).status,403);
  eq((await request('/api/points/gifts',{id:2,body:giftBody})).status,403);
  const gifted=await request('/api/points/gifts',{id:1,body:giftBody});eq(gifted.status,200);eq(gifted.audit,'ok');
  eq((await request('/api/points/gifts',{id:1,body:giftBody})).body.replayed,true);
  eq(db.prepare('SELECT bonus_units FROM point_asset_accounts WHERE user_id=2').get().bonus_units,20000);
  const identity=await request('/api/referrals?view=identity',{ip:'198.51.100.1'});ok(identity.cookie.includes('HttpOnly'));const inviterDevice=identity.cookie.split(';')[0];
  const inviteState=await request('/api/referrals',{id:1,device:inviterDevice,ip:'198.51.100.1'});eq(inviteState.status,200);ok(inviteState.body.code);
  const inviteeDevice=(await request('/api/referrals?view=identity',{ip:'198.51.100.25'})).cookie.split(';')[0];
  const registration={username:'invited',email:'invited@example.test',password:'Strong-password-123!',code:registrationCode,invitationCode:'0000000000000000'};
  eq((await request('/api/auth/register',{body:registration,device:inviteeDevice,ip:'198.51.100.25'})).status,400);
  eq(db.prepare("SELECT consumed_at FROM verification_codes WHERE email='invited@example.test'").get().consumed_at,null,'invalid invite does not burn email verification code');
  eq(db.prepare("SELECT 1 FROM users WHERE username='invited'").get(),undefined);
  const registered=await request('/api/auth/register',{body:{...registration,invitationCode:inviteState.body.code},device:inviteeDevice,ip:'198.51.100.25'});
  eq(registered.status,200);ok(registered.cookie.includes('nexus_token='));
  const invitation=db.prepare('SELECT * FROM referral_invitations WHERE invitee_id=?').get(registered.body.user.id);eq(invitation.status,'pending');
  eq((await request('/api/referrals',{id:1,device:inviterDevice,ip:'198.51.100.1'})).body.rewarded,0);
  db.prepare('UPDATE referral_invitations SET eligible_at=? WHERE id=?').run(Date.now()-1,invitation.id);
  const settled=await request('/api/referrals',{id:1,device:inviterDevice,ip:'198.51.100.1'});
  eq(settled.body.rewarded,1,JSON.stringify(db.prepare('SELECT status,risk_flags,eligible_at FROM referral_invitations').all()));
  eq(db.prepare('SELECT bonus_units FROM point_asset_accounts WHERE user_id=1').get().bonus_units,20000);
  const issue={action:'issue',userId:2,productId:1,durationDays:30,note:'HTTP验收'};
  eq((await request('/api/runtime-authorizations',{id:3,body:issue})).status,403);
  eq((await request('/api/runtime-authorizations',{id:1,body:{...issue,durationDays:7}})).status,400);
  const issued=await request('/api/runtime-authorizations',{id:1,body:issue});eq(issued.status,200);ok(issued.body.code);ok(issued.cache.includes('no-store')); 
  const own=await request('/api/runtime-authorizations',{id:2});eq(own.body.items.length,1);ok(!JSON.stringify(own.body).includes(issued.body.code));
  eq((await request('/api/runtime-authorizations',{id:4})).body.items.length,0);
  const check={action:'authorize',code:issued.body.code,productId:1,account:'12345678',server:'HTTP-Demo',device:'a'.repeat(64)};
  const valid=await request('/api/ea/runtime',{body:check,native:true});eq(valid.status,200);eq(valid.body.valid,true);eq(valid.body.leaseSeconds,60);
  eq((await request('/api/ea/runtime',{body:{...check,device:'b'.repeat(64)},native:true})).status,401);
  eq((await request('/api/ea/runtime',{body:{action:'authorize'},native:true})).status,400);
  const connection=await request('/api/ea-connections',{id:2,body:{action:'create',licenseId:1,label:'我的模拟账户',consent:true}});eq(connection.status,200);ok(connection.body.token);ok(connection.cache.includes('no-store')); 
  eq((await request('/api/ea-connections',{id:4,body:{action:'create',licenseId:1,label:'他人账户',consent:true}})).status,403);
  eq((await request('/api/ea-connections',{id:2,body:{action:'create',licenseId:1,label:'未同意',consent:false}})).status,400);
  const snapshot={action:'heartbeat',token:connection.body.token,productId:1,account:'12345678',server:'HTTP-Demo',device:'a'.repeat(64),sequence:1,currency:'USD',balance:1000,equity:1010,floatingProfit:10,freeMargin:900,positionsCount:1,eaPositionsCount:1,eaFloatingProfit:10};
  eq((await request('/api/ea/runtime',{body:snapshot,native:true})).status,200);
  eq((await request('/api/ea/runtime',{body:snapshot,native:true})).status,409);
  const activity=await request('/api/ea-connections',{id:2});eq(activity.body.items[0].status,'online');eq(activity.body.items[0].equity,1010);ok(!JSON.stringify(activity.body).includes(connection.body.token));ok(!JSON.stringify(activity.body).includes('12345678'));
  eq((await request('/api/ea-connections',{id:4})).body.items.length,0);
  eq((await request('/api/ea-connections',{id:4,body:{action:'revoke',id:connection.body.id}})).status,404);
  eq((await request('/api/ea-connections',{id:2,body:{action:'revoke',id:connection.body.id}})).status,200);
  eq((await request('/api/ea/runtime',{body:{...snapshot,sequence:2},native:true})).status,401);
  eq((await request('/api/runtime-authorizations',{id:1,body:{action:'revoke',id:issued.body.authorization.id,note:'HTTP测试撤销'}})).status,200);
  eq((await request('/api/ea/runtime',{body:check,native:true})).status,401);
  const auditText=JSON.stringify(db.prepare("SELECT metadata_json FROM audit_logs WHERE event_type LIKE 'runtime.%' OR event_type LIKE 'ea.%'").all());
  ok(!auditText.includes(issued.body.code));ok(!auditText.includes(connection.body.token));
  eq(db.pragma('foreign_key_check').length,0);
  console.log(JSON.stringify({success:true,assertions:count,scope:'isolated production HTTP; no real user balances or trading accounts used'}));
} finally {
  if(server&&server.exitCode===null){server.kill();await Promise.race([new Promise(resolve=>server.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,2000))]);}
  db?.close();assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep));
  fs.rmSync(directory,{recursive:true,force:true,maxRetries:10,retryDelay:100});
}
