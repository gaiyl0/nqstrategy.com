import db from '../lib/db.js';

const issues=[];
const balances=new Map();
for(const row of db.prepare('SELECT * FROM point_asset_transactions ORDER BY user_id,id').iterate()){
  const before=balances.get(row.user_id)||{funded:0,bonus:0,withdrawable:0};
  const after={funded:before.funded+row.funded_delta,bonus:before.bonus+row.bonus_delta,withdrawable:before.withdrawable+row.withdrawable_delta};
  if(after.funded!==row.funded_after||after.bonus!==row.bonus_after||after.withdrawable!==row.withdrawable_after)issues.push(`transaction:${row.id}:running_balance`);
  if(after.funded<0||after.bonus<0||after.withdrawable<0||after.withdrawable>after.funded)issues.push(`transaction:${row.id}:source_invariant`);
  balances.set(row.user_id,after);
}
for(const row of db.prepare('SELECT * FROM point_asset_accounts').iterate()){
  const ledger=balances.get(row.user_id)||{funded:0,bonus:0,withdrawable:0};
  if(ledger.funded!==row.funded_units||ledger.bonus!==row.bonus_units||ledger.withdrawable!==row.withdrawable_units)issues.push(`account:${row.user_id}:ledger_mismatch`);
  balances.delete(row.user_id);
}
for(const userId of balances.keys())issues.push(`account:${userId}:missing`);
for(const sale of db.prepare('SELECT * FROM point_asset_sales').iterate()){
  const buyer=db.prepare('SELECT funded_delta,bonus_delta FROM point_asset_transactions WHERE business_key=?').get(`redeem:${sale.buyer_user_id}:${sale.product_id}`);
  const creator=db.prepare('SELECT funded_delta,bonus_delta,withdrawable_delta FROM point_asset_transactions WHERE business_key=?').get(`sale:${sale.order_id}:creator`);
  if(!buyer||buyer.funded_delta!==-sale.funded_spent_units||buyer.bonus_delta!==-sale.bonus_spent_units)issues.push(`sale:${sale.order_id}:buyer_debit`);
  if(!creator||creator.funded_delta!==sale.creator_funded_units||creator.bonus_delta!==sale.creator_bonus_units||creator.withdrawable_delta!==sale.creator_funded_units)issues.push(`sale:${sale.order_id}:creator_credit`);
  if(sale.price_units!==sale.funded_spent_units+sale.bonus_spent_units||sale.creator_funded_units+sale.platform_funded_units!==sale.funded_spent_units||sale.creator_bonus_units+sale.platform_bonus_units!==sale.bonus_spent_units)issues.push(`sale:${sale.order_id}:split`);
}
for(const withdrawal of db.prepare('SELECT * FROM point_asset_withdrawals').iterate()){
  const hold=db.prepare('SELECT funded_delta,withdrawable_delta FROM point_asset_transactions WHERE business_key=?').get(`withdrawal:${withdrawal.id}:hold`);
  const refund=db.prepare('SELECT funded_delta,withdrawable_delta FROM point_asset_transactions WHERE business_key=?').get(`withdrawal:${withdrawal.id}:refund`);
  if(!hold||hold.funded_delta!==-withdrawal.units||hold.withdrawable_delta!==-withdrawal.units)issues.push(`withdrawal:${withdrawal.id}:hold`);
  if(withdrawal.status==='rejected'&&(!refund||refund.funded_delta!==withdrawal.units||refund.withdrawable_delta!==withdrawal.units))issues.push(`withdrawal:${withdrawal.id}:refund`);
  if(withdrawal.status!=='rejected'&&refund)issues.push(`withdrawal:${withdrawal.id}:unexpected_refund`);
}
for(const recharge of db.prepare('SELECT * FROM point_recharge_orders').iterate()){
  const credit=db.prepare('SELECT user_id,funded_delta,bonus_delta,withdrawable_delta,reason FROM point_asset_transactions WHERE business_key=?').get(`recharge:${recharge.id}`);
  if(recharge.status==='paid'){
    if(!recharge.provider_trade_no||!recharge.paid_at||recharge.paid_at<recharge.created_at-1000||recharge.paid_at>recharge.expires_at)issues.push(`recharge:${recharge.id}:payment_metadata`);
    if(!credit||credit.user_id!==recharge.user_id||credit.funded_delta!==recharge.points_units||credit.bonus_delta!==0||credit.withdrawable_delta!==0||credit.reason!=='verified_recharge')issues.push(`recharge:${recharge.id}:credit`);
  }else if(credit)issues.push(`recharge:${recharge.id}:unexpected_credit`);
}
const result={valid:issues.length===0,accounts:db.prepare('SELECT COUNT(*) count FROM point_asset_accounts').get().count,transactions:db.prepare('SELECT COUNT(*) count FROM point_asset_transactions').get().count,sales:db.prepare('SELECT COUNT(*) count FROM point_asset_sales').get().count,withdrawals:db.prepare('SELECT COUNT(*) count FROM point_asset_withdrawals').get().count,recharges:db.prepare('SELECT COUNT(*) count FROM point_recharge_orders').get().count,issues};
console.log(JSON.stringify(result));
db.close();
if(!result.valid)process.exitCode=1;
