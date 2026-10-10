import crypto from 'node:crypto';
import {notifyUser} from './inbox.js';
import db from './db.js';
import {applyPointAssetDelta} from './point-assets.js';
import {alipayPaymentConfig} from './point-payment-config.js';
import {queryAlipayRefund,submitAlipayRefund} from './alipay-gateway.mjs';

// Replay non-withdrawable funded sources FIFO. Later top-ups cannot make an already consumed recharge refundable.
export function remainingRechargeUnits(userId) {
  const lots=[];
  for(const row of db.prepare('SELECT * FROM point_asset_transactions WHERE user_id=? ORDER BY id').iterate(userId)) {
    const delta=row.funded_delta-row.withdrawable_delta;
    if(!delta)continue;
    if(['recharge_refund_hold','recharge_refund_release'].includes(row.reason)) {
      const metadata=JSON.parse(row.metadata||'{}');
      const lot=lots.find(x=>x.key===`recharge:${metadata.rechargeOrderId}`);
      if(!lot||lot.units+delta<0)throw Error('REFUND_SOURCE_INVALID');
      lot.units+=delta;
    } else if(delta>0)lots.push({key:row.business_key,units:delta});
    else {
      let remaining=-delta;
      for(const lot of lots){const spent=Math.min(lot.units,remaining);lot.units-=spent;remaining-=spent;if(!remaining)break;}
      if(remaining)throw Error('REFUND_SOURCE_INVALID');
    }
  }
  return new Map(lots.filter(x=>x.key.startsWith('recharge:')).map(x=>[Number(x.key.slice(9)),x.units]));
}

export function refundableUnits(order) {
  if(order.status!=='paid'||order.provider!=='alipay'||order.cny_fen!==order.points_units||order.cny_fen_per_usd!==100)return 0;
  return remainingRechargeUnits(order.user_id).get(order.id)||0;
}

export function requestRechargeRefund(userId,{orderId,units,reason,requestKey},now=Date.now()) {
  if(!Number.isSafeInteger(units)||units<1||!Number.isSafeInteger(orderId)||orderId<1||typeof reason!=='string'||reason.trim().length<2||reason.length>300||
    !/^[0-9a-f-]{36}$/i.test(requestKey||''))throw Error('REFUND_REQUEST_INVALID');
  return db.transaction(()=>{
    const prior=db.prepare('SELECT * FROM point_recharge_refunds WHERE request_key=?').get(requestKey);
    if(prior){if(prior.user_id!==userId||prior.order_id!==orderId||prior.units!==units||prior.reason!==reason.trim())throw Error('REFUND_KEY_CONFLICT');return prior;}
    const order=db.prepare('SELECT * FROM point_recharge_orders WHERE id=? AND user_id=?').get(orderId,userId);
    if(db.prepare("SELECT 1 FROM point_recharge_refunds WHERE order_id=? AND status IN ('pending','processing','unknown')").get(orderId))throw Error('REFUND_ALREADY_OPEN');
    if(!order||units>refundableUnits(order))throw Error('REFUND_AMOUNT_UNAVAILABLE');
    const id=Number(db.prepare('INSERT INTO point_recharge_refunds(order_id,user_id,units,request_key,reason,created_at,updated_at) VALUES(?,?,?,?,?,?,?)')
      .run(orderId,userId,units,requestKey,reason.trim(),now,now).lastInsertRowid);
    applyPointAssetDelta(userId,{funded:-units},`recharge-refund:${id}:hold`,'recharge_refund_hold',{rechargeOrderId:orderId,refundId:id},now);
    notifyUser(userId,'points','充值退款申请已提交',`退款申请 #${id} 已冻结 ${units/100} 积分，等待管理员审核。`,'/?route=profile',now);
    for(const admin of db.prepare("SELECT id FROM users WHERE role='admin' AND deleted_at IS NULL").all())notifyUser(admin.id,'points','新的充值退款申请',`退款申请 #${id}：${units/100} 元，等待审核。`,'/tianwei',now);
    return db.prepare('SELECT * FROM point_recharge_refunds WHERE id=?').get(id);
  }).immediate();
}

export function listRechargeRefunds(user,{page=1,userId=null,admin=false}={}) {
  if(!user?.id||(admin&&user.role!=='admin'))throw Error('REFUND_FORBIDDEN');
  if(!Number.isSafeInteger(page)||page<1||page>1000000||(userId!==null&&(!Number.isSafeInteger(userId)||userId<1)))throw Error('FINANCE_QUERY_INVALID');
  const owner=admin?userId:user.id,where=owner===null?'':' WHERE r.user_id=?',args=owner===null?[]:[owner];
  const total=db.prepare(`SELECT COUNT(*) n FROM point_recharge_refunds r${where}`).get(...args).n;
  const items=db.prepare(`SELECT r.id,r.order_id,r.user_id,u.username,r.units,r.status,r.reason,r.reviewer_note,r.created_at,r.paid_at,r.error_code,r.attempts
    FROM point_recharge_refunds r LEFT JOIN users u ON u.id=r.user_id${where} ORDER BY r.id DESC LIMIT 50 OFFSET ?`).all(...args,(page-1)*50);
  return {view:'refunds',items,pagination:{page,pageSize:50,total,totalPages:Math.max(1,Math.ceil(total/50))}};
}

export function rejectRechargeRefund(admin,id,note,now=Date.now()) {
  if(admin?.role!=='admin')throw Error('REFUND_FORBIDDEN');
  if(typeof note!=='string'||!note.trim()||note.length>300)throw Error('REFUND_REQUEST_INVALID');
  return db.transaction(()=>{
    const refund=db.prepare('SELECT * FROM point_recharge_refunds WHERE id=?').get(id);
    if(!refund)throw Error('REFUND_NOT_FOUND');
    if(refund.status==='rejected')return {id,state:'rejected'};
    if(refund.status!=='pending')throw Error('REFUND_CANNOT_REJECT');
    db.prepare("UPDATE point_recharge_refunds SET status='rejected',reviewer_id=?,reviewer_note=?,updated_at=? WHERE id=?").run(admin.id,note.trim(),now,id);
    applyPointAssetDelta(refund.user_id,{funded:refund.units},`recharge-refund:${id}:release`,'recharge_refund_release',{rechargeOrderId:refund.order_id,refundId:id},now);
    notifyUser(refund.user_id,'points','充值退款申请已驳回',`申请 #${id}，冻结积分已退回。原因：${note.trim()}`,'/?route=profile',now);
    return {id,state:'rejected'};
  }).immediate();
}

export async function checkRechargeRefund(id,{admin=null,submit=false,fetchImpl=fetch,now=Date.now()}={}) {
  if(submit&&admin?.role!=='admin')throw Error('REFUND_FORBIDDEN');
  const token=crypto.randomUUID();
  const refund=db.transaction(()=>{
    const row=db.prepare('SELECT * FROM point_recharge_refunds WHERE id=?').get(id);
    if(!row)throw Error('REFUND_NOT_FOUND');
    if(['paid','rejected'].includes(row.status))return row;
    if(!submit&&row.status==='pending')throw Error('REFUND_NOT_APPROVED');
    if(row.lease_until>now)return null;
    db.prepare("UPDATE point_recharge_refunds SET status='processing',lease_token=?,lease_until=?,updated_at=?,reviewer_id=COALESCE(reviewer_id,?) WHERE id=?")
      .run(token,now+120000,now,admin?.id||null,id);
    return row;
  }).immediate();
  if(!refund)return {id,state:'busy'};
  if(['paid','rejected'].includes(refund.status))return {id,state:refund.status};
  let paid=false,errorCode=null;
  try {
    const order=db.prepare('SELECT * FROM point_recharge_orders WHERE id=?').get(refund.order_id),config=alipayPaymentConfig();
    if(refund.attempts>0||!submit)paid=(await queryAlipayRefund(order,refund,config,fetchImpl)).paid;
    if(!paid&&submit)paid=(await submitAlipayRefund(order,refund,config,fetchImpl)).paid;
    if(!paid)errorCode='REFUND_CONFIRMATION_PENDING';
  }catch(error){errorCode=/^[A-Z][A-Z0-9_]{2,80}$/.test(error?.message||'')?error.message:'REFUND_PROVIDER_UNAVAILABLE';}
  db.transaction(()=>{
    const changed=db.prepare(`UPDATE point_recharge_refunds SET status=?,paid_at=?,error_code=?,attempts=attempts+1,updated_at=?,next_check_at=?,lease_token=NULL,lease_until=0
    WHERE id=? AND lease_token=?`).run(paid?'paid':'unknown',paid?Date.now():null,errorCode,Date.now(),Date.now()+600000,id,token).changes;
    if(changed&&paid)notifyUser(refund.user_id,'points','充值退款已完成',`申请 #${id} 已确认原路退款 ${refund.units/100} 元，冻结积分已完成冲正。`,'/?route=profile');
  }).immediate();
  return {id,state:paid?'paid':'unknown',errorCode};
}

export async function runRechargeRefundChecks({limit=2,fetchImpl=fetch,now=Date.now()}={}) {
  if(!Number.isInteger(limit)||limit<1||limit>5)throw Error('REFUND_LIMIT_INVALID');
  const rows=db.prepare("SELECT id FROM point_recharge_refunds WHERE status IN ('processing','unknown') AND attempts<8 AND next_check_at<=? AND lease_until<=? ORDER BY id LIMIT ?").all(now,now,limit);
  const results=[];
  for(const row of rows)results.push(await checkRechargeRefund(row.id,{fetchImpl,now}));
  return {processed:results.length,confirmed:results.filter(x=>x.state==='paid').length};
}
