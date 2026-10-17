import crypto from 'node:crypto';
import db from './db.js';
import {hashSecurityValue} from './security.js';
import {applyPointAssetDelta} from './point-assets.js';
import {notifyUser} from './inbox.js';

const DAY=86400000,COOKIE='nexus_invite_device';
const activeUser=id=>db.prepare("SELECT id,email,email_verified,join_date FROM users WHERE id=? AND deleted_at IS NULL AND role<>'banned'").get(id);
const emailIdentity=email=>{
  let [local,domain]=String(email).trim().toLowerCase().split('@');
  if(domain==='googlemail.com')domain='gmail.com';
  local=local.split('+')[0];
  if(domain==='gmail.com')local=local.replaceAll('.','');
  return hashSecurityValue('referral-email',`${local}@${domain}`);
};

export function readReferralDevice(request) {
  const raw=request.cookies?.get(COOKIE)?.value || String(request.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(`${COOKIE}=`))?.slice(COOKIE.length+1);
  const [id,signature]=String(raw||'').split('.');
  if(!/^[a-f0-9]{48}$/.test(id||'')||signature!==hashSecurityValue('invite-cookie',id))return null;
  return hashSecurityValue('invite-device',id);
}

export function attachReferralDevice(response,request) {
  if(!readReferralDevice(request)){
    const id=crypto.randomBytes(24).toString('hex');
    response.cookies.set(COOKIE,`${id}.${hashSecurityValue('invite-cookie',id)}`,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:180*86400});
  }
  response.headers.set('Cache-Control','private, no-store');
  return response;
}

export function rememberReferralSignal(userId,{deviceHash=null,sourceHash=null,sourceTrusted=false}={},now=Date.now()) {
  const user=activeUser(userId);
  if(!user)return;
  db.prepare('INSERT OR IGNORE INTO referral_signals(user_id,device_hash,source_hash,email_hash,created_at) VALUES(?,?,?,?,?)')
    .run(userId,deviceHash,sourceTrusted?sourceHash:null,emailIdentity(user.email),now);
}

export function recordReferralRegistration(userId,code,signals,now=Date.now()) {
  // Called inside the registration transaction: a failed referral cannot consume the email code or leave a partial account.
  rememberReferralSignal(userId,signals,now);
  if(!code)return null;
  const owner=db.prepare('SELECT user_id FROM referral_codes WHERE code=?').get(String(code).trim().toUpperCase());
  const inviter=owner&&activeUser(owner.user_id),invitee=activeUser(userId);
  if(!inviter||!invitee||inviter.id===userId)throw Error('INVITATION_INVALID');
  const risk=riskFlags(inviter.id,userId,now);
  const id=Number(db.prepare(`INSERT INTO referral_invitations(inviter_id,invitee_id,status,risk_flags,eligible_at,created_at)
    VALUES(?,?,?,?,?,?)`).run(inviter.id,userId,risk.length?'review':'pending',JSON.stringify(risk),now+DAY,now).lastInsertRowid);
  return id;
}

function riskFlags(inviterId,inviteeId,now) {
  const flags=[],inviter=activeUser(inviterId),invitee=activeUser(inviteeId);
  if(!inviter||!invitee)flags.push('account_unavailable');
  if(!inviter?.email_verified||!invitee?.email_verified)flags.push('email_unverified');
  const signal=db.prepare('SELECT * FROM referral_signals WHERE user_id=?').get(inviteeId);
  if(!signal?.device_hash)flags.push('device_missing');
  if(!signal?.source_hash)flags.push('source_unresolved');
  if(signal?.device_hash&&db.prepare('SELECT 1 FROM referral_signals WHERE device_hash=? AND user_id<>?').get(signal.device_hash,inviteeId))flags.push('shared_device');
  if(signal?.source_hash&&db.prepare('SELECT 1 FROM referral_signals WHERE source_hash=? AND user_id<>? AND (created_at>=? OR user_id=?)').get(signal.source_hash,inviteeId,now-DAY,inviterId))flags.push('shared_network');
  if(signal?.email_hash&&db.prepare('SELECT 1 FROM referral_signals WHERE email_hash=? AND user_id<>?').get(signal.email_hash,inviteeId))flags.push('email_alias');
  const joined=Date.parse(String(inviter?.join_date||'').replace(' ','T')+'Z');
  if(!Number.isFinite(joined)||now-joined<DAY)flags.push('new_inviter');
  if(db.prepare('SELECT COUNT(*) n FROM referral_invitations WHERE inviter_id=? AND created_at>=? AND invitee_id<>?').get(inviterId,now-DAY,inviteeId).n>=3)flags.push('daily_limit');
  if(db.prepare('SELECT COUNT(*) n FROM referral_invitations WHERE inviter_id=? AND created_at>=? AND invitee_id<>?').get(inviterId,now-30*DAY,inviteeId).n>=10)flags.push('monthly_limit');
  return flags;
}

function award(row,now) {
  const transaction=applyPointAssetDelta(row.inviter_id,{bonus:row.reward_units},`invite:${row.id}`,'referral_reward',{invitationId:row.id,inviteeId:row.invitee_id},now);
  db.prepare("UPDATE referral_invitations SET status='rewarded',transaction_id=? WHERE id=?").run(transaction.id,row.id);
  if(!transaction.replayed)notifyUser(row.inviter_id,'reward','邀请奖励到账','一位受邀用户已完成注册核验，200 奖励积分已到账。奖励积分及其产生的奖励分成不可提现。','/?route=points',now);
}

export function settleReferralRewards({inviterId=null,limit=100,now=Date.now()}={}) {
  return db.transaction(()=>{
    const rows=db.prepare(`SELECT * FROM referral_invitations WHERE status='pending' AND eligible_at<=? ${inviterId?'AND inviter_id=?':''} ORDER BY id LIMIT ?`).all(now,...(inviterId?[inviterId]:[]),Math.min(100,Math.max(1,limit)));
    let rewarded=0,review=0;
    for(const row of rows){
      const flags=riskFlags(row.inviter_id,row.invitee_id,now);
      if(flags.length){db.prepare("UPDATE referral_invitations SET status='review',risk_flags=? WHERE id=?").run(JSON.stringify(flags),row.id);review++;}
      else {award(row,now);rewarded++;}
    }
    return {processed:rows.length,rewarded,review};
  }).immediate();
}

export function referralState(userId,signals,now=Date.now()) {
  if(!activeUser(userId))throw Error('INVITATION_INVALID');
  if(signals)rememberReferralSignal(userId,signals,now);
  settleReferralRewards({inviterId:userId,now});
  let code=db.prepare('SELECT code FROM referral_codes WHERE user_id=?').get(userId)?.code;
  if(!code){
    db.prepare('INSERT OR IGNORE INTO referral_codes(user_id,code,created_at) VALUES(?,?,?)').run(userId,crypto.randomBytes(8).toString('hex').toUpperCase(),now);
    code=db.prepare('SELECT code FROM referral_codes WHERE user_id=?').get(userId).code;
  }
  const items=db.prepare(`SELECT r.id,r.status,r.eligible_at eligibleAt,r.created_at createdAt,r.review_note reviewNote,
    r.reward_units/100.0 rewardPoints FROM referral_invitations r WHERE r.inviter_id=? ORDER BY r.id DESC LIMIT 50`).all(userId);
  const counts=db.prepare("SELECT COUNT(*) invited,COALESCE(SUM(status='rewarded'),0) rewarded FROM referral_invitations WHERE inviter_id=?").get(userId);
  return {code,rewardPoints:200,cooldownHours:24,items,...counts};
}

export function listReferralReviews(admin,{page=1}={}) {
  if(admin?.role!=='admin')throw Error('REFERRAL_FORBIDDEN');
  settleReferralRewards();
  const offset=(Math.max(1,page)-1)*50;
  const items=db.prepare(`SELECT r.*,a.username inviterName,b.username inviteeName,b.email_verified emailVerified
    FROM referral_invitations r JOIN users a ON a.id=r.inviter_id JOIN users b ON b.id=r.invitee_id
    ORDER BY CASE r.status WHEN 'review' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,r.id DESC LIMIT 50 OFFSET ?`).all(offset)
    .map(({risk_flags,...row})=>({...row,riskFlags:JSON.parse(risk_flags)}));
  return {items,total:db.prepare('SELECT COUNT(*) n FROM referral_invitations').get().n,page};
}

export function reviewReferral(admin,id,approve,note,now=Date.now()) {
  if(admin?.role!=='admin')throw Error('REFERRAL_FORBIDDEN');
  if(typeof note!=='string'||note.trim().length<3||note.length>300)throw Error('REFERRAL_NOTE_REQUIRED');
  return db.transaction(()=>{
    const row=db.prepare('SELECT * FROM referral_invitations WHERE id=?').get(id);
    if(!row)throw Error('REFERRAL_NOT_FOUND');
    if(!['pending','review'].includes(row.status))throw Error('REFERRAL_ALREADY_REVIEWED');
    if(approve&&now<row.eligible_at)throw Error('REFERRAL_COOLDOWN');
    if(approve&&(!activeUser(row.inviter_id)?.email_verified||!activeUser(row.invitee_id)?.email_verified))throw Error('REFERRAL_ACCOUNT_UNAVAILABLE');
    if(approve)award(row,now);
    else db.prepare("UPDATE referral_invitations SET status='rejected' WHERE id=?").run(id);
    db.prepare('UPDATE referral_invitations SET reviewed_by=?,reviewed_at=?,review_note=? WHERE id=?').run(admin.id,now,note.trim(),id);
    return {status:approve?'rewarded':'rejected'};
  }).immediate();
}
