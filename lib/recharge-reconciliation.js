import crypto from 'node:crypto';
import db from './db.js';
import {pointRechargeOrder,reconcilePointRecharge} from './point-payment-service.js';

const MINUTE=60_000,DAY=24*60*MINUTE;
const safeCode=error=>/^[A-Z][A-Z0-9_]{2,80}$/.test(error?.message||'')?error.message:'PAYMENT_QUERY_ERROR';
const needsReview=code=>/SIGNATURE|MISMATCH|CONFLICT|SETTLEMENT_INVALID|NOT_PAYABLE|TRADE_ALREADY_USED/.test(code);

export function queuePointRechargeChecks(now=Date.now()) {
  // Catch up recent orders; older orders remain available for explicit admin lookup.
  db.prepare(`INSERT OR IGNORE INTO point_recharge_checks(order_id,next_check_at)
    SELECT id,created_at+120000 FROM point_recharge_orders WHERE status='pending' AND created_at>=?`).run(now-3*DAY);
  db.prepare(`UPDATE point_recharge_checks SET state='credited',error_code=NULL WHERE state!='credited'
    AND order_id IN (SELECT id FROM point_recharge_orders WHERE status='paid')`).run();
}

export async function checkPointRecharge(orderId,{manual=false,fetchImpl=fetch,now=Date.now()}={}) {
  const order=pointRechargeOrder(orderId);
  if(order.status==='paid')return {orderId,state:'credited',paid:true};
  if(order.status!=='pending')return {orderId,state:'closed',paid:false};
  const token=crypto.randomUUID();
  const acquired=db.transaction(()=>{
    db.prepare('INSERT OR IGNORE INTO point_recharge_checks(order_id,next_check_at) VALUES(?,?)').run(orderId,now);
    return db.prepare(`UPDATE point_recharge_checks SET lease_token=?,lease_until=? WHERE order_id=? AND lease_until<=?
      ${manual?'':"AND state IN ('waiting','error') AND next_check_at<=?"}`).run(token,now+120_000,orderId,now,...(manual?[]:[now])).changes===1;
  }).immediate();
  if(!acquired)return {orderId,state:'busy',paid:false};
  let state='waiting',errorCode=null,paid=false;
  try {
    const result=await reconcilePointRecharge(order,{fetchImpl});paid=result.paid===true;
    state=paid?'credited':['TRADE_CLOSED','CLOSED','REVOKED','PAYERROR'].includes(result.state)||now>=order.expires_at+DAY?'closed':'waiting';
  } catch(error) {
    errorCode=safeCode(error);
    const previous=db.prepare('SELECT failures FROM point_recharge_checks WHERE order_id=?').get(orderId);
    state=needsReview(errorCode)||previous.failures>=7?'review':'error';
  }
  const checkedAt=Date.now();
  const failures=db.prepare('SELECT failures FROM point_recharge_checks WHERE order_id=?').get(orderId).failures;
  const delay=errorCode?Math.min(60*MINUTE,MINUTE*2**Math.min(failures,6)):now>=order.expires_at?15*MINUTE:5*MINUTE;
  db.prepare(`UPDATE point_recharge_checks SET state=?,attempts=attempts+1,failures=?,last_checked_at=?,next_check_at=?,
    error_code=?,lease_token=NULL,lease_until=0 WHERE order_id=? AND lease_token=?`).run(state,errorCode?failures+1:0,checkedAt,checkedAt+delay,errorCode,orderId,token);
  return {orderId,state,paid,errorCode};
}

export async function runPointRechargeChecks({limit=10,fetchImpl=fetch,now=Date.now()}={}) {
  if(!Number.isInteger(limit)||limit<1||limit>20)throw new Error('RECONCILE_LIMIT_INVALID');
  queuePointRechargeChecks(now);
  db.prepare(`INSERT INTO point_recharge_worker_state(id,last_started_at) VALUES(1,?)
    ON CONFLICT(id) DO UPDATE SET last_started_at=excluded.last_started_at`).run(now);
  const due=db.prepare(`SELECT c.order_id FROM point_recharge_checks c JOIN point_recharge_orders o ON o.id=c.order_id
    WHERE o.status='pending' AND c.state IN ('waiting','error') AND c.next_check_at<=? AND c.lease_until<=?
    ORDER BY c.next_check_at,c.order_id LIMIT ?`).all(now,now,limit);
  const results=[];
  for(const row of due)results.push(await checkPointRecharge(row.order_id,{fetchImpl,now}));
  const errors=results.filter(x=>['error','review'].includes(x.state)).length;
  db.prepare('UPDATE point_recharge_worker_state SET last_finished_at=?,processed=?,errors=? WHERE id=1').run(Date.now(),results.length,errors);
  return {processed:results.length,errors,credited:results.filter(x=>x.paid).length};
}

export function rechargeCheckOverview(user,{page=1,userId=null}={}) {
  if(user?.role!=='admin')throw new Error('FINANCE_FORBIDDEN');
  if(!Number.isSafeInteger(page)||page<1||page>1000000||(userId!==null&&(!Number.isSafeInteger(userId)||userId<1)))throw new Error('FINANCE_QUERY_INVALID');
  const where="WHERE c.state IN ('error','review') AND o.status='pending'"+(userId===null?'':' AND o.user_id=?');
  const args=userId===null?[]:[userId];
  const from='FROM point_recharge_checks c JOIN point_recharge_orders o ON o.id=c.order_id';
  const total=db.prepare(`SELECT COUNT(*) n ${from} ${where}`).get(...args).n;
  const items=db.prepare(`SELECT o.id,o.user_id,u.username,o.provider,o.points_units,o.cny_fen,o.created_at,c.state,c.attempts,c.failures,c.last_checked_at,c.next_check_at,c.error_code
    ${from} LEFT JOIN users u ON u.id=o.user_id ${where} ORDER BY c.last_checked_at DESC,o.id DESC LIMIT 50 OFFSET ?`).all(...args,(page-1)*50);
  return {view:'exceptions',items,pagination:{page,pageSize:50,total,totalPages:Math.max(1,Math.ceil(total/50))},worker:db.prepare('SELECT last_started_at,last_finished_at,processed,errors FROM point_recharge_worker_state WHERE id=1').get()||null};
}
