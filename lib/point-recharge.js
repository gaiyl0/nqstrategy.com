import db from './db.js';

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

// The gateway adapter will call this only after it can create a signed provider order.
// The stored rate and CNY amount never change when an admin edits the site rate later.
export function createPointRechargeOrder(userId,points,provider,requestKey,now=Date.now()) {
  if (!['wechat','alipay'].includes(provider) || !/^[a-zA-Z0-9:_-]{12,120}$/.test(requestKey)) throw new Error('RECHARGE_REQUEST_INVALID');
  return db.transaction(()=>{
    const existing=db.prepare('SELECT * FROM point_recharge_orders WHERE request_key=?').get(requestKey);
    const quote=quotePointRecharge(points);
    if(existing){if(existing.user_id!==userId||existing.points_units!==quote.pointsUnits||existing.provider!==provider)throw new Error('RECHARGE_KEY_CONFLICT');return {id:existing.id,pointsUnits:existing.points_units,cnyFen:existing.cny_fen,cnyFenPerUsd:existing.cny_fen_per_usd,replayed:true};}
    const id=Number(db.prepare(`INSERT INTO point_recharge_orders(user_id,points_units,cny_fen,cny_fen_per_usd,provider,request_key,created_at,expires_at)
      VALUES(?,?,?,?,?,?,?,?)`).run(userId,quote.pointsUnits,quote.cnyFen,quote.cnyFenPerUsd,provider,requestKey,now,now+15*60_000).lastInsertRowid);
    return {id,pointsUnits:quote.pointsUnits,cnyFen:quote.cnyFen,cnyFenPerUsd:quote.cnyFenPerUsd,replayed:false};
  }).immediate();
}
