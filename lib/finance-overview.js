import db from './db.js';

export function financeOverview(user,{view='recharges',page=1,userId=null}={}) {
  if(user?.role!=='admin')throw new Error('FINANCE_FORBIDDEN');
  if(!['recharges','points','sales','withdrawals'].includes(view)||!Number.isSafeInteger(page)||page<1||page>1000000||
    (userId!==null&&(!Number.isSafeInteger(userId)||userId<1)))throw new Error('FINANCE_QUERY_INVALID');
  const tables={recharges:'point_recharge_orders',points:'point_asset_transactions',sales:'point_asset_sales',withdrawals:'point_asset_withdrawals'};
  const owner=view==='sales'?'buyer_user_id':'user_id';
  const where=userId===null?'':` WHERE r.${owner}=?`;
  const args=userId===null?[]:[userId];
  const table=tables[view];
  const total=db.prepare(`SELECT COUNT(*) n FROM ${table} r${where}`).get(...args).n;
  const columns={recharges:'r.id,r.user_id,r.points_units,r.cny_fen,r.provider,r.status,r.provider_trade_no,r.created_at,r.expires_at,r.paid_at',
    points:'r.id,r.user_id,r.funded_delta,r.bonus_delta,r.withdrawable_delta,r.funded_after,r.bonus_after,r.withdrawable_after,r.reason,r.created_at',
    sales:'r.order_id id,r.buyer_user_id user_id,r.developer_user_id,r.product_id,r.price_units,r.funded_spent_units,r.bonus_spent_units,r.creator_funded_units,r.platform_funded_units,r.created_at',
    withdrawals:'r.id,r.user_id,r.units,r.status,r.reviewer_note,r.created_at,r.reviewed_at'};
  const rows=db.prepare(`SELECT ${columns[view]},u.username FROM ${table} r LEFT JOIN users u ON u.id=r.${owner}${where} ORDER BY r.${view==='sales'?'order_id':'id'} DESC LIMIT 50 OFFSET ?`).all(...args,(page-1)*50);
  const now=Date.now();
  const items=rows.map(row=>({...row,status:view==='recharges'&&row.status==='pending'&&row.expires_at<=now?'expired':row.status}));
  const recharge=db.prepare("SELECT COALESCE(SUM(cny_fen),0) fen,COUNT(*) n FROM point_recharge_orders WHERE status='paid'").get();
  const withdrawal=db.prepare("SELECT COALESCE(SUM(units),0) units FROM point_asset_withdrawals WHERE status='completed'").get();
  const sales=db.prepare('SELECT COALESCE(SUM(price_units),0) units,COALESCE(SUM(platform_funded_units),0) platform FROM point_asset_sales').get();
  return {view,items,pagination:{page,pageSize:50,total,totalPages:Math.max(1,Math.ceil(total/50))},
    summary:{rechargeCny:recharge.fen/100,paidRecharges:recharge.n,withdrawalCny:withdrawal.units/100,salesPoints:sales.units/100,platformFundedPoints:sales.platform/100}};
}
