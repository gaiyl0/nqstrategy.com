import crypto from 'node:crypto';
import db from './db.js';
import {requireSystemOwner} from './system-owner.js';
import {notifyUser} from './inbox.js';

const DAY=86400000;
const hash=value=>crypto.createHash('sha256').update(String(value)).digest('hex');
const accountMask=account=>`****${String(account).slice(-4)}`;
const binding=({account,server,device})=>hash(JSON.stringify([account,server.trim().toLowerCase(),device]));
function validPrincipal(userId,productId) {
  return Boolean(db.prepare("SELECT 1 FROM users u,products p WHERE u.id=? AND u.deleted_at IS NULL AND u.role<>'banned' AND p.id=? AND p.deleted_at IS NULL AND p.status='active'").get(userId,productId));
}
const authorizationDto=(row,now=Date.now())=>({id:row.id,userId:row.user_id,productId:row.product_id,username:row.username,productTitle:row.productTitle,codeHint:row.code_hint,durationDays:row.duration_days,status:row.status==='active'&&row.expires_at<=now?'expired':row.status,accountMask:row.account_mask,serverName:row.server_name,activatedAt:row.activated_at,expiresAt:row.expires_at,createdAt:row.created_at,note:row.note});

export function listRuntimeAuthorizations(user,{admin=false,page=1}={}) {
  if(admin)requireSystemOwner(user);
  const where=admin?'':'WHERE a.user_id=?';
  const items=db.prepare(`SELECT a.*,u.username,p.title productTitle FROM runtime_authorizations a JOIN users u ON u.id=a.user_id JOIN products p ON p.id=a.product_id ${where} ORDER BY a.id DESC LIMIT 50 OFFSET ?`).all(...(admin?[]:[user.id]),(page-1)*50).map(row=>authorizationDto(row));
  const total=db.prepare(`SELECT COUNT(*) n FROM runtime_authorizations a ${where}`).get(...(admin?[]:[user.id])).n;
  return {items,total,page};
}

export function issueRuntimeAuthorization(admin,{userId,productId,durationDays,note=''},now=Date.now()) {
  requireSystemOwner(admin);
  if(![30,90,365].includes(durationDays)||!Number.isSafeInteger(userId)||!Number.isSafeInteger(productId)||note.length>300)throw Error('RUNTIME_INPUT_INVALID');
  return db.transaction(()=>{
    if(!validPrincipal(userId,productId))throw Error('RUNTIME_PRINCIPAL_UNAVAILABLE');
    const code=`NQ-${crypto.randomBytes(20).toString('hex').toUpperCase()}`;
    const id=Number(db.prepare(`INSERT INTO runtime_authorizations(user_id,product_id,code_hash,code_hint,duration_days,issued_by,created_at,updated_at,note) VALUES(?,?,?,?,?,?,?,?,?)`).run(userId,productId,hash(code),`NQ-****${code.slice(-6)}`,durationDays,admin.id,now,now,note.trim()).lastInsertRowid);
    db.prepare("INSERT INTO runtime_authorization_events(authorization_id,action,actor_id,note,created_at) VALUES(?,'issue',?,?,?)").run(id,admin.id,note.trim(),now);
    notifyUser(userId,'license','新的 EA 运行授权',`已签发 ${durationDays} 天授权。请向管理员领取授权码，在支持在线校验的 EA 中首次激活后开始计时。`,'/?route=profile&tab=runtime',now);
    return {authorization:authorizationDto(db.prepare('SELECT * FROM runtime_authorizations WHERE id=?').get(id),now),code};
  }).immediate();
}

export function manageRuntimeAuthorization(admin,{id,action,durationDays,note},now=Date.now()) {
  requireSystemOwner(admin);
  if(!['revoke','renew','reset_binding'].includes(action)||typeof note!=='string'||note.trim().length<3||note.length>300)throw Error('RUNTIME_INPUT_INVALID');
  return db.transaction(()=>{
    const row=db.prepare('SELECT * FROM runtime_authorizations WHERE id=?').get(id);
    if(!row)throw Error('RUNTIME_NOT_FOUND');
    if(row.status==='revoked')throw Error('RUNTIME_REVOKED');
    if(action==='revoke')db.prepare("UPDATE runtime_authorizations SET status='revoked',revoked_at=?,updated_at=? WHERE id=?").run(now,now,id);
    if(action==='renew'){
      if(![30,90,365].includes(durationDays))throw Error('RUNTIME_INPUT_INVALID');
      if(row.status==='issued')db.prepare('UPDATE runtime_authorizations SET duration_days=?,updated_at=? WHERE id=?').run(durationDays,now,id);
      else db.prepare('UPDATE runtime_authorizations SET expires_at=?,updated_at=? WHERE id=?').run(Math.max(now,row.expires_at)+durationDays*DAY,now,id);
    }
    if(action==='reset_binding')db.prepare('UPDATE runtime_authorizations SET binding_hash=NULL,account_mask=NULL,server_name=NULL,updated_at=? WHERE id=?').run(now,id);
    db.prepare('INSERT INTO runtime_authorization_events(authorization_id,action,actor_id,note,created_at) VALUES(?,?,?,?,?)').run(id,action,admin.id,note.trim(),now);
    return authorizationDto(db.prepare('SELECT * FROM runtime_authorizations WHERE id=?').get(id),now);
  }).immediate();
}

export function authorizeRuntime({code,productId,account,server,device},now=Date.now()) {
  return db.transaction(()=>{
    const row=db.prepare('SELECT * FROM runtime_authorizations WHERE code_hash=?').get(hash(String(code).trim().toUpperCase()));
    if(!row||row.product_id!==productId||row.status==='revoked'||!validPrincipal(row.user_id,row.product_id))throw Error('RUNTIME_INVALID');
    if(row.status==='active'&&row.expires_at<=now)throw Error('RUNTIME_EXPIRED');
    const digest=binding({account,server,device});
    if(row.binding_hash&&row.binding_hash!==digest)throw Error('RUNTIME_BINDING_MISMATCH');
    const expires=row.status==='issued'?now+row.duration_days*DAY:row.expires_at;
    db.prepare("UPDATE runtime_authorizations SET status='active',binding_hash=?,account_mask=?,server_name=?,activated_at=COALESCE(activated_at,?),expires_at=?,updated_at=? WHERE id=?").run(digest,accountMask(account),server.trim(),now,expires,now,row.id);
    if(row.status==='issued')db.prepare("INSERT INTO runtime_authorization_events(authorization_id,action,note,created_at) VALUES(?,'activate','First EA activation',?)").run(row.id,now);
    return {valid:true,authorizationId:row.id,productId:row.product_id,expiresAt:expires,leaseSeconds:Math.min(60,Math.max(1,Math.floor((expires-now)/1000))),serverTime:now};
  }).immediate();
}

function eligibleLicense(userId,licenseId,now) {
  return db.prepare(`SELECT l.* FROM product_licenses l JOIN orders o ON o.id=l.source_order_id JOIN users u ON u.id=l.user_id JOIN products p ON p.id=l.product_id
    WHERE l.id=? AND l.user_id=? AND l.license_type<>'trial' AND l.status='active' AND l.starts_at<=? AND (l.expires_at IS NULL OR l.expires_at>?)
    AND u.deleted_at IS NULL AND u.role<>'banned' AND p.deleted_at IS NULL AND p.status='active'
    AND o.buyer_user_id=l.user_id AND o.product_id=l.product_id AND o.status='completed' AND (o.price=0 OR o.payment_verified=1)`).get(licenseId,userId,now,now);
}

export function createEaConnection(user,{licenseId,label,consent},now=Date.now()) {
  if(consent!==true||typeof label!=='string'||label.trim().length<1||label.length>60)throw Error('EA_CONSENT_REQUIRED');
  return db.transaction(()=>{
    const license=eligibleLicense(user.id,licenseId,now);
    if(!license)throw Error('EA_LICENSE_REQUIRED');
    if(db.prepare("SELECT COUNT(*) n FROM ea_connections WHERE user_id=? AND status='active'").get(user.id).n>=5)throw Error('EA_CONNECTION_LIMIT');
    const token=`NQT-${crypto.randomBytes(32).toString('hex')}`;
    const id=Number(db.prepare('INSERT INTO ea_connections(user_id,product_id,license_id,token_hash,token_hint,label,consent_at,created_at) VALUES(?,?,?,?,?,?,?,?)').run(user.id,license.product_id,license.id,hash(token),`NQT-****${token.slice(-6)}`,label.trim(),now,now).lastInsertRowid);
    return {id,productId:license.product_id,token};
  }).immediate();
}

export function listEaConnections(userId,now=Date.now()) {
  return db.prepare(`SELECT c.*,p.title productTitle FROM ea_connections c JOIN products p ON p.id=c.product_id WHERE c.user_id=? ORDER BY c.id DESC LIMIT 50`).all(userId).map(row=>{
    const eligible=row.status==='active'&&Boolean(eligibleLicense(userId,row.license_id,now));
    return {id:row.id,productId:row.product_id,productTitle:row.productTitle,label:row.label,status:!eligible?'revoked':!row.last_seen_at?'waiting':now-row.last_seen_at<=120000?'online':'offline',tokenHint:row.token_hint,accountMask:row.account_mask,serverName:row.server_name,lastSeenAt:row.last_seen_at,currency:row.currency,balance:row.balance,equity:row.equity,floatingProfit:row.floating_profit,freeMargin:row.free_margin,positionsCount:row.positions_count,eaPositionsCount:row.ea_positions_count,eaFloatingProfit:row.ea_floating_profit};
  });
}

export function revokeEaConnection(userId,id,now=Date.now()) {
  const row=db.prepare('SELECT user_id FROM ea_connections WHERE id=?').get(id);
  if(!row||row.user_id!==userId)throw Error('EA_CONNECTION_NOT_FOUND');
  db.prepare("UPDATE ea_connections SET status='revoked',revoked_at=COALESCE(revoked_at,?) WHERE id=?").run(now,id);
}

export function receiveEaHeartbeat({token,productId,account,server,device,sequence,currency,balance,equity,floatingProfit,freeMargin,positionsCount,eaPositionsCount,eaFloatingProfit},now=Date.now()) {
  return db.transaction(()=>{
    const row=db.prepare('SELECT * FROM ea_connections WHERE token_hash=?').get(hash(token));
    if(!row||row.status!=='active'||row.product_id!==productId||!eligibleLicense(row.user_id,row.license_id,now))throw Error('EA_CONNECTION_INVALID');
    const digest=binding({account,server,device});
    if(row.binding_hash&&row.binding_hash!==digest)throw Error('EA_BINDING_MISMATCH');
    if(!Number.isSafeInteger(sequence)||sequence<=row.last_sequence)throw Error('EA_REPLAYED');
    if(row.last_seen_at&&now-row.last_seen_at<15000)throw Error('EA_TOO_FREQUENT');
    if(![balance,equity,floatingProfit,freeMargin,eaFloatingProfit].every(value=>Number.isFinite(value)&&Math.abs(value)<=1e12)||!Number.isInteger(positionsCount)||positionsCount<0||positionsCount>10000||!Number.isInteger(eaPositionsCount)||eaPositionsCount<0||eaPositionsCount>positionsCount||!/^[A-Z0-9]{3,10}$/.test(currency))throw Error('EA_SNAPSHOT_INVALID');
    db.prepare(`UPDATE ea_connections SET binding_hash=?,account_mask=?,server_name=?,last_seen_at=?,last_sequence=?,currency=?,balance=?,equity=?,floating_profit=?,free_margin=?,positions_count=?,ea_positions_count=?,ea_floating_profit=? WHERE id=?`)
      .run(digest,accountMask(account),server.trim(),now,sequence,currency,balance,equity,floatingProfit,freeMargin,positionsCount,eaPositionsCount,eaFloatingProfit,row.id);
    return {accepted:true,serverTime:now,nextHeartbeatSeconds:30};
  }).immediate();
}
