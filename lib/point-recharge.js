import db from './db.js';
import { applyPointAssetDelta, pointsFromUnits } from './point-assets.js';
import { notifyUser } from './inbox.js';

export function configuredRechargeExchangeRate() {
  const raw = db.prepare("SELECT value FROM settings WHERE key='pointCnyFenPerUsd'").get()?.value;
  if (raw == null) return null;
  const rate = Number(raw);
  if (!Number.isInteger(rate) || rate < 100 || rate > 2000) throw new Error('RECHARGE_RATE_INVALID');
  return rate;
}

export function rechargeExchangeRate() {
  const rate=configuredRechargeExchangeRate();
  if(rate==null)throw new Error('RECHARGE_RATE_UNSET');
  return rate;
}

export function setRechargeExchangeRate(rate) {
  if (!Number.isInteger(rate) || rate < 100 || rate > 2000) throw new Error('RECHARGE_RATE_INVALID');
  db.prepare("INSERT INTO settings(key,value) VALUES('pointCnyFenPerUsd',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(rate));
  return rate;
}

export function quotePointRecharge(points, rate = rechargeExchangeRate()) {
  const units = Math.round(points * 100);
  if (!Number.isSafeInteger(units) || units < 100 || units > 100000000 || Math.abs(points * 100 - units) > 0.000001) throw new Error('RECHARGE_POINTS_INVALID');
  if (!Number.isInteger(rate) || rate < 100 || rate > 2000) throw new Error('RECHARGE_RATE_INVALID');
  return { points, pointsUnits: units, cnyFenPerUsd: rate, cnyFen: Math.ceil(units * rate / 100), available: false };
}

// The gateway adapter must create and reconcile the signed provider order before
// displaying a payment code; creating this database row alone is not checkout.
// The stored rate and CNY amount never change when an admin edits the site rate later.
export function createPointRechargeOrder(userId,points,provider,requestKey,now=Date.now()) {
  if (!['wechat','alipay'].includes(provider) || !/^[a-zA-Z0-9:_-]{12,120}$/.test(requestKey)) throw new Error('RECHARGE_REQUEST_INVALID');
  return db.transaction(()=>{
    const existing=db.prepare('SELECT * FROM point_recharge_orders WHERE request_key=?').get(requestKey);
    const units=Math.round(points*100);
    if(!Number.isSafeInteger(units)||units<100||units>100000000||Math.abs(points*100-units)>0.000001)throw new Error('RECHARGE_POINTS_INVALID');
    if(existing){if(existing.user_id!==userId||existing.points_units!==units||existing.provider!==provider)throw new Error('RECHARGE_KEY_CONFLICT');return {id:existing.id,pointsUnits:existing.points_units,cnyFen:existing.cny_fen,cnyFenPerUsd:existing.cny_fen_per_usd,replayed:true};}
    const quote=quotePointRecharge(points);
    const id=Number(db.prepare(`INSERT INTO point_recharge_orders(user_id,points_units,cny_fen,cny_fen_per_usd,provider,request_key,created_at,expires_at)
      VALUES(?,?,?,?,?,?,?,?)`).run(userId,quote.pointsUnits,quote.cnyFen,quote.cnyFenPerUsd,provider,requestKey,now,now+15*60_000).lastInsertRowid);
    return {id,pointsUnits:quote.pointsUnits,cnyFen:quote.cnyFen,cnyFenPerUsd:quote.cnyFenPerUsd,replayed:false};
  }).immediate();
}

// Internal settlement boundary. A provider adapter must verify the signed callback,
// query the provider independently, and compare merchant identity before calling it.
// Never expose this function through an admin or browser-controlled payment-success API.
export function settleVerifiedPointRecharge({orderId,provider,providerTradeNo,cnyFen,paidAt},now=Date.now()) {
  if(!Number.isSafeInteger(orderId)||orderId<=0||!['wechat','alipay'].includes(provider)||
    typeof providerTradeNo!=='string'||!/^[a-zA-Z0-9_-]{6,128}$/.test(providerTradeNo)||
    !Number.isSafeInteger(cnyFen)||cnyFen<=0||!Number.isSafeInteger(paidAt)||paidAt<=0)throw new Error('RECHARGE_SETTLEMENT_INVALID');
  return db.transaction(()=>{
    const order=db.prepare('SELECT * FROM point_recharge_orders WHERE id=?').get(orderId);
    if(!order)throw new Error('RECHARGE_ORDER_NOT_FOUND');
    if(order.provider!==provider||order.cny_fen!==cnyFen)throw new Error('RECHARGE_PAYMENT_MISMATCH');
    if(order.status==='paid'){
      if(order.provider_trade_no!==providerTradeNo||order.paid_at!==paidAt)throw new Error('RECHARGE_PAYMENT_CONFLICT');
      return {orderId,points:pointsFromUnits(order.points_units),replayed:true};
    }
    // Providers commonly report payment time only to the second; allow that
    // truncation at the creation boundary while preserving the expiry limit.
    if(order.status!=='pending'||paidAt<order.created_at-1000||paidAt>order.expires_at)throw new Error('RECHARGE_ORDER_NOT_PAYABLE');
    if(db.prepare('SELECT id FROM point_recharge_orders WHERE provider_trade_no=?').get(providerTradeNo))throw new Error('RECHARGE_TRADE_ALREADY_USED');
    const updated=db.prepare("UPDATE point_recharge_orders SET status='paid',provider_trade_no=?,paid_at=? WHERE id=? AND status='pending'")
      .run(providerTradeNo,paidAt,orderId);
    if(updated.changes!==1)throw new Error('RECHARGE_ORDER_NOT_PAYABLE');
    applyPointAssetDelta(order.user_id,{funded:order.points_units},`recharge:${orderId}`,'verified_recharge',
      {orderId,provider,cnyFen:order.cny_fen,cnyFenPerUsd:order.cny_fen_per_usd},now);
    notifyUser(order.user_id,'points','积分充值到账',`${pointsFromUnits(order.points_units)} 积分已到账。`,'/?route=points',now);
    return {orderId,points:pointsFromUnits(order.points_units),replayed:false};
  }).immediate();
}
