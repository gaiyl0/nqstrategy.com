import db from './db.js';

export const POINT_UNITS = 100;
export const pointsFromUnits = units => Number((units / POINT_UNITS).toFixed(2));

export function pointAssetAccount(userId,now=Date.now()) {
  db.prepare('INSERT OR IGNORE INTO point_asset_accounts(user_id,updated_at) VALUES(?,?)').run(userId,now);
  return db.prepare('SELECT funded_units fundedUnits,bonus_units bonusUnits,withdrawable_units withdrawableUnits FROM point_asset_accounts WHERE user_id=?').get(userId);
}

export function applyPointAssetDelta(userId,{funded=0,bonus=0,withdrawable=0},businessKey,reason,metadata={},now=Date.now()) {
  if(![funded,bonus,withdrawable].every(Number.isSafeInteger)||(!funded&&!bonus&&!withdrawable))throw new Error('POINT_DELTA_INVALID');
  const prior=db.prepare('SELECT * FROM point_asset_transactions WHERE business_key=?').get(businessKey);
  if(prior){if(prior.user_id!==userId||prior.funded_delta!==funded||prior.bonus_delta!==bonus||prior.withdrawable_delta!==withdrawable)throw new Error('POINT_KEY_CONFLICT');return {id:prior.id,replayed:true,account:{fundedUnits:prior.funded_after,bonusUnits:prior.bonus_after,withdrawableUnits:prior.withdrawable_after}};}
  const before=pointAssetAccount(userId,now);
  const after={fundedUnits:before.fundedUnits+funded,bonusUnits:before.bonusUnits+bonus,withdrawableUnits:before.withdrawableUnits+withdrawable};
  if(Object.values(after).some(value=>!Number.isSafeInteger(value)||value<0)||after.withdrawableUnits>after.fundedUnits)throw new Error('INSUFFICIENT_POINTS');
  db.prepare('UPDATE point_asset_accounts SET funded_units=?,bonus_units=?,withdrawable_units=?,updated_at=? WHERE user_id=?').run(after.fundedUnits,after.bonusUnits,after.withdrawableUnits,now,userId);
  const id=Number(db.prepare(`INSERT INTO point_asset_transactions(user_id,funded_delta,bonus_delta,withdrawable_delta,funded_after,bonus_after,withdrawable_after,business_key,reason,metadata,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(userId,funded,bonus,withdrawable,after.fundedUnits,after.bonusUnits,after.withdrawableUnits,businessKey,reason,JSON.stringify(metadata),now).lastInsertRowid);
  return {id,replayed:false,account:after};
}

export function spendPointAssets(userId,units,businessKey,metadata={},now=Date.now()) {
  if(!Number.isSafeInteger(units)||units<=0)throw new Error('POINT_PRICE_UNAVAILABLE');
  const before=pointAssetAccount(userId,now);
  if(before.fundedUnits+before.bonusUnits<units)throw new Error('INSUFFICIENT_POINTS');
  // Reward credits are spent first, so a sale never creates withdrawable funds from rewards.
  const bonusSpent=Math.min(before.bonusUnits,units);
  const fundedSpent=units-bonusSpent;
  const nonWithdrawableFunded=before.fundedUnits-before.withdrawableUnits;
  const withdrawableSpent=Math.max(0,fundedSpent-nonWithdrawableFunded);
  const result=applyPointAssetDelta(userId,{funded:-fundedSpent,bonus:-bonusSpent,withdrawable:-withdrawableSpent},businessKey,'strategy_purchase',metadata,now);
  return {fundedSpent,bonusSpent,withdrawableSpent,balance:pointsFromUnits(result.account.fundedUnits+result.account.bonusUnits)};
}

export function creditPointSale(developerId,orderId,fundedSpent,bonusSpent,now=Date.now()) {
  const creatorFunded=Math.floor(fundedSpent*0.8);
  const creatorBonus=Math.floor(bonusSpent*0.8);
  const transaction=applyPointAssetDelta(developerId,{funded:creatorFunded,bonus:creatorBonus,withdrawable:creatorFunded},`sale:${orderId}:creator`,'strategy_sale',{orderId},now);
  return {creatorFunded,creatorBonus,platformFunded:fundedSpent-creatorFunded,platformBonus:bonusSpent-creatorBonus,transactionId:transaction.id};
}

export function requestPointWithdrawal(userId,points,note='',now=Date.now()) {
  const units=Math.round(points*POINT_UNITS);
  if(!Number.isSafeInteger(units)||units<10000||units>100000000||Math.abs(points*POINT_UNITS-units)>0.000001)throw new Error('WITHDRAWAL_AMOUNT_INVALID');
  if(typeof note!=='string'||note.trim().length<5||note.length>200)throw new Error('WITHDRAWAL_PAYOUT_DETAILS_INVALID');
  return db.transaction(()=>{
    const user=db.prepare("SELECT id,role FROM users WHERE id=? AND deleted_at IS NULL").get(userId);
    if(!user||!['developer','admin'].includes(user.role))throw new Error('WITHDRAWAL_FORBIDDEN');
    if(db.prepare("SELECT 1 FROM point_asset_withdrawals WHERE user_id=? AND status='pending'").get(userId))throw new Error('WITHDRAWAL_PENDING');
    if(pointAssetAccount(userId,now).withdrawableUnits<units)throw new Error('INSUFFICIENT_WITHDRAWABLE_POINTS');
    const id=Number(db.prepare('INSERT INTO point_asset_withdrawals(user_id,units,applicant_note,created_at) VALUES(?,?,?,?)').run(userId,units,note,now).lastInsertRowid);
    applyPointAssetDelta(userId,{funded:-units,withdrawable:-units},`withdrawal:${id}:hold`,'withdrawal_hold',{withdrawalId:id,currency:'CNY'},now);
    return {id,points:pointsFromUnits(units),currency:'CNY',amountCny:pointsFromUnits(units)};
  }).immediate();
}

export function reviewPointWithdrawal(adminId,id,approve,note='',now=Date.now()) {
  return db.transaction(()=>{
    const row=db.prepare('SELECT * FROM point_asset_withdrawals WHERE id=?').get(id);
    if(!row)throw new Error('WITHDRAWAL_NOT_FOUND');
    if(row.status!=='pending')throw new Error('WITHDRAWAL_ALREADY_REVIEWED');
    if(!approve)applyPointAssetDelta(row.user_id,{funded:row.units,withdrawable:row.units},`withdrawal:${id}:refund`,'withdrawal_refund',{withdrawalId:id},now);
    db.prepare('UPDATE point_asset_withdrawals SET status=?,reviewer_note=?,reviewer_user_id=?,reviewed_at=? WHERE id=?').run(approve?'completed':'rejected',note,adminId,now,id);
    return {userId:row.user_id,status:approve?'completed':'rejected',points:pointsFromUnits(row.units),currency:'CNY',amountCny:pointsFromUnits(row.units)};
  }).immediate();
}

export function listPointWithdrawals(user,{limit=100,ownOnly=false}={}) {
  const rows=user.role==='admin'&&!ownOnly?db.prepare('SELECT w.*,u.username FROM point_asset_withdrawals w JOIN users u ON u.id=w.user_id ORDER BY w.id DESC LIMIT ?').all(limit)
    :db.prepare('SELECT w.*,u.username FROM point_asset_withdrawals w JOIN users u ON u.id=w.user_id WHERE w.user_id=? ORDER BY w.id DESC LIMIT ?').all(user.id,limit);
  return rows.map(row=>({id:row.id,userId:row.user_id,username:row.username,points:pointsFromUnits(row.units),currency:'CNY',amountCny:pointsFromUnits(row.units),status:row.status,applicantNote:row.applicant_note,reviewerNote:row.reviewer_note,createdAt:row.created_at,reviewedAt:row.reviewed_at}));
}
