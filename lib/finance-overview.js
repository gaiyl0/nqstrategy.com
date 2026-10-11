import db from './db.js';

const PAGE_SIZE=50,EXPORT_LIMIT=10000;
const views={
  recharges:{from:'point_recharge_orders r',owner:'r.user_id',id:'r.id',date:'r.created_at',amount:'r.cny_fen',status:'r.status',provider:'r.provider',columns:'r.id,r.user_id,r.points_units,r.cny_fen,r.provider,r.status,r.provider_trade_no,r.created_at,r.expires_at,r.paid_at',statuses:['pending','expired','paid','failed']},
  points:{from:'point_asset_transactions r',owner:'r.user_id',id:'r.id',date:'r.created_at',amount:'r.funded_delta+r.bonus_delta',columns:'r.id,r.user_id,r.funded_delta,r.bonus_delta,r.withdrawable_delta,r.funded_after,r.bonus_after,r.withdrawable_after,r.reason,r.created_at'},
  sales:{from:'point_asset_sales r',owner:'r.buyer_user_id',id:'r.order_id',date:'r.created_at',amount:'r.price_units',columns:'r.order_id id,r.buyer_user_id user_id,r.developer_user_id,r.product_id,r.price_units,r.funded_spent_units,r.bonus_spent_units,r.creator_funded_units,r.platform_funded_units,r.created_at'},
  withdrawals:{from:'point_asset_withdrawals r',owner:'r.user_id',id:'r.id',date:'r.created_at',amount:'r.units',status:'r.status',columns:'r.id,r.user_id,r.units,r.status,r.reviewer_note,r.created_at,r.reviewed_at',statuses:['pending','completed','rejected']},
  refunds:{from:'point_recharge_refunds r JOIN point_recharge_orders o ON o.id=r.order_id',owner:'r.user_id',id:'r.order_id',sort:'r.id',date:'r.created_at',amount:'r.units',status:'r.status',provider:'o.provider',columns:'r.id,r.order_id,r.user_id,r.units,r.status,r.reason,r.reviewer_note,r.created_at,r.paid_at,r.error_code,r.attempts,o.provider',statuses:['pending','processing','unknown','paid','rejected']},
  exceptions:{from:'point_recharge_checks c JOIN point_recharge_orders r ON r.id=c.order_id',owner:'r.user_id',id:'r.id',date:'r.created_at',amount:'r.cny_fen',status:'c.state',provider:'r.provider',columns:'r.id,r.user_id,r.provider,r.points_units,r.cny_fen,r.created_at,c.state,c.attempts,c.failures,c.last_checked_at,c.next_check_at,c.error_code',statuses:['error','review']},
};

function dateBoundary(value,next=false){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('FINANCE_QUERY_INVALID');
  const [year,month,day]=value.split('-').map(Number),utc=Date.UTC(year,month-1,day);
  if(new Date(utc).toISOString().slice(0,10)!==value)throw Error('FINANCE_QUERY_INVALID');
  return utc-8*3600000+(next?86400000:0);
}

function filteredQuery(user,{view='recharges',page=1,userId=null,from='',to='',status='',provider='',orderId=null}={}){
  if(user?.role!=='admin')throw Error('FINANCE_FORBIDDEN');
  const config=views[view];
  if(!config||!Number.isSafeInteger(page)||page<1||page>1000000||
    (userId!==null&&(!Number.isSafeInteger(userId)||userId<1))||
    (orderId!==null&&(!Number.isSafeInteger(orderId)||orderId<1))||
    (status&&(!config.statuses||!config.statuses.includes(status)))||
    (provider&&(!config.provider||!['alipay','wechat'].includes(provider))))throw Error('FINANCE_QUERY_INVALID');
  const start=from?dateBoundary(from):null,end=to?dateBoundary(to,true):null;
  if(start!==null&&end!==null&&start>=end)throw Error('FINANCE_QUERY_INVALID');
  const conditions=[],args=[];
  if(view==='exceptions')conditions.push("c.state IN ('error','review')","r.status='pending'");
  for(const [value,column,operator] of [[userId,config.owner,'='],[orderId,config.id,'='],[start,config.date,'>='],[end,config.date,'<'],[view==='recharges'&&['pending','expired'].includes(status)?'pending':status||null,config.status,'='],[provider||null,config.provider,'=']]){
    if(value!==null){conditions.push(`${column}${operator}?`);args.push(value);}
  }
  if(view==='recharges'&&['pending','expired'].includes(status)){conditions.push(`r.expires_at${status==='expired'?'<=':'>'}?`);args.push(Date.now());}
  return {config,view,page,from:`FROM ${config.from} LEFT JOIN users u ON u.id=${config.owner}`,where:conditions.length?` WHERE ${conditions.join(' AND ')}`:'',args};
}

function queryRows(query,limit,offset){
  const {config,from,where,args}=query;
  return db.prepare(`SELECT ${config.columns},u.username ${from}${where} ORDER BY ${config.sort||config.id} DESC LIMIT ? OFFSET ?`).all(...args,limit,offset)
    .map(row=>({...row,status:query.view==='recharges'&&row.status==='pending'&&row.expires_at<=Date.now()?'expired':row.status}));
}

export function financeOverview(user,options={}){
  const query=filteredQuery(user,options),{config,view,page,from,where,args}=query;
  const filtered=db.prepare(`SELECT COUNT(*) total,COALESCE(SUM(${config.amount}),0) amountUnits ${from}${where}`).get(...args);
  const items=queryRows(query,PAGE_SIZE,(page-1)*PAGE_SIZE);
  // Lifetime figures are independent of the current list filters.
  const recharge=db.prepare("SELECT COALESCE(SUM(cny_fen),0) fen,COUNT(*) n FROM point_recharge_orders WHERE status='paid'").get();
  const refunded=db.prepare("SELECT COALESCE(SUM(units),0) units FROM point_recharge_refunds WHERE status='paid'").get();
  const withdrawal=db.prepare("SELECT COALESCE(SUM(units),0) units FROM point_asset_withdrawals WHERE status='completed'").get();
  const sales=db.prepare('SELECT COALESCE(SUM(price_units),0) units,COALESCE(SUM(platform_funded_units),0) platform FROM point_asset_sales').get();
  return {view,items,pagination:{page,pageSize:PAGE_SIZE,total:filtered.total,totalPages:Math.max(1,Math.ceil(filtered.total/PAGE_SIZE))},
    filtered:{count:filtered.total,amount:filtered.amountUnits/100,unit:['recharges','exceptions','withdrawals','refunds'].includes(view)?'CNY':'points'},
    summary:{rechargeCny:recharge.fen/100,paidRecharges:recharge.n,refundCny:refunded.units/100,netRechargeCny:(recharge.fen-refunded.units)/100,withdrawalCny:withdrawal.units/100,salesPoints:sales.units/100,platformFundedPoints:sales.platform/100},
    ...(view==='exceptions'?{worker:db.prepare('SELECT last_started_at,last_finished_at,processed,errors FROM point_recharge_worker_state WHERE id=1').get()||null}:{})};
}

const exportFields={
  recharges:[['id','订单号'],['user_id','用户ID'],['username','用户名'],['provider','支付渠道'],['status','状态'],['cny_fen','人民币分'],['points_units','积分百分之一'],['provider_trade_no','平台流水号'],['created_at','创建时间戳'],['paid_at','支付时间戳']],
  points:[['id','流水号'],['user_id','用户ID'],['username','用户名'],['reason','变动原因'],['funded_delta','充值积分变动'],['bonus_delta','奖励积分变动'],['funded_after','充值积分余额'],['bonus_after','奖励积分余额'],['withdrawable_after','可提现积分余额'],['created_at','创建时间戳']],
  sales:[['id','订单号'],['user_id','买家ID'],['username','买家'],['developer_user_id','开发者ID'],['product_id','商品ID'],['price_units','售价积分百分之一'],['funded_spent_units','充值积分支出'],['bonus_spent_units','奖励积分支出'],['creator_funded_units','可提现分成'],['platform_funded_units','平台分成'],['created_at','创建时间戳']],
  withdrawals:[['id','提现号'],['user_id','用户ID'],['username','用户名'],['status','状态'],['units','人民币分'],['created_at','创建时间戳'],['reviewed_at','审核时间戳']],
  refunds:[['id','退款申请号'],['order_id','充值订单号'],['user_id','用户ID'],['username','用户名'],['provider','支付渠道'],['status','状态'],['units','人民币分'],['created_at','创建时间戳'],['paid_at','退款时间戳'],['error_code','错误码']],
  exceptions:[['id','充值订单号'],['user_id','用户ID'],['username','用户名'],['provider','支付渠道'],['state','异常状态'],['cny_fen','人民币分'],['attempts','查询次数'],['failures','连续失败'],['error_code','错误码'],['created_at','创建时间戳'],['last_checked_at','最近查询时间戳']],
};

function csvCell(value){
  let text=String(value??'').replace(/[\r\n\t]/g,' ').trim();
  if(typeof value!=='number'&&/^[=+@-]/.test(text))text=`'${text}`;
  return `"${text.replaceAll('"','""')}"`;
}

export function financeCsv(user,options={}){
  const query=filteredQuery(user,options),{view,from,where,args}=query;
  const total=db.prepare(`SELECT COUNT(*) total ${from}${where}`).get(...args).total;
  if(total>EXPORT_LIMIT)throw Error('FINANCE_EXPORT_TOO_LARGE');
  const columns=exportFields[view],rows=queryRows(query,EXPORT_LIMIT,0);
  return '\uFEFF'+[columns.map(([,label])=>csvCell(label)).join(','),...rows.map(row=>columns.map(([field])=>csvCell(row[field])).join(','))].join('\r\n')+'\r\n';
}
