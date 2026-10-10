import crypto from 'node:crypto';
import { forumAccess,siteFeatureAccess } from './forum-feature.js';
import db from './db.js';
import { ensureOrderLicense } from './licensing.js';
import { getCurrentVersion } from './product-versions.js';
import {applyPointAssetDelta,creditPointSale,pointAssetAccount,pointsFromUnits,spendPointAssets} from './point-assets.js';
import {notifyUser} from './inbox.js';
import {pointRechargeAvailability} from './point-payment-config.js';

const dayInShanghai = now => new Intl.DateTimeFormat('sv-SE', {
  timeZone:'Asia/Shanghai', year:'numeric', month:'2-digit', day:'2-digit',
}).format(new Date(now));

const currentBalance=(userId,now=Date.now())=>{const item=pointAssetAccount(userId,now);return pointsFromUnits(item.fundedUnits+item.bonusUnits);};
function writeBonusPoints(userId,points,businessKey,reason,metadata={},now=Date.now()){
  const result=applyPointAssetDelta(userId,{bonus:points*100},businessKey,reason,metadata,now);
  return {id:result.id,replayed:result.replayed,balance:pointsFromUnits(result.account.fundedUnits+result.account.bonusUnits)};
}

export function pointState(userId){
  const forumActive = forumAccess().enabled;
  const account=pointAssetAccount(userId);
  const balance=pointsFromUnits(account.fundedUnits+account.bonusUnits);
  const tasks=siteFeatureAccess().tasks?db.prepare('SELECT id,code,title,description,reward_points rewardPoints,cadence,review_mode reviewMode,target_url targetUrl,proof_label proofLabel,enabled FROM point_tasks WHERE enabled=1 ORDER BY is_system DESC,id').all().filter(task => forumActive || !['daily_post','daily_comment'].includes(task.code)):[];
  const claims=db.prepare(`SELECT c.id,c.task_id taskId,t.code,t.title taskTitle,c.status,c.contact_email contactEmail,c.customer_id customerId,c.proof_text proofText,c.reviewer_note reviewerNote,c.created_at createdAt,c.reviewed_at reviewedAt
    FROM point_task_claims c JOIN point_tasks t ON t.id=c.task_id WHERE c.user_id=? ORDER BY c.created_at DESC`).all(userId);
  const transactions=db.prepare('SELECT id,funded_delta fundedDelta,bonus_delta bonusDelta,funded_after fundedAfter,bonus_after bonusAfter,reason,created_at createdAt FROM point_asset_transactions WHERE user_id=? ORDER BY id DESC LIMIT 40').all(userId)
    .map(row=>({id:row.id,delta:pointsFromUnits(row.fundedDelta+row.bonusDelta),fundedDelta:pointsFromUnits(row.fundedDelta),
      bonusDelta:pointsFromUnits(row.bonusDelta),balanceAfter:pointsFromUnits(row.fundedAfter+row.bonusAfter),reason:row.reason,createdAt:row.createdAt}));
  const today=dayInShanghai(Date.now());
  const todayRewards=[...new Set([
    ...db.prepare("SELECT reason FROM point_asset_transactions WHERE user_id=? AND business_key LIKE ? AND bonus_delta>0").all(userId,`daily:%:${userId}:${today}`).map(row=>row.reason),
    ...db.prepare("SELECT reason FROM point_transactions WHERE user_id=? AND business_key LIKE ? AND delta>0").all(userId,`daily:%:${userId}:${today}`).map(row=>row.reason),
  ])];
  const settings=Object.fromEntries(db.prepare("SELECT key,value FROM settings WHERE key IN ('socialXUrl','telegramGroupUrl','exchangeAdUrl')").all().map(row=>[row.key,row.value]));
  for(const task of tasks){if(!task.targetUrl)task.targetUrl=task.code==='follow_x'?settings.socialXUrl||'':task.code==='join_telegram'?settings.telegramGroupUrl||'':task.code==='tmgm_deposit'?settings.exchangeAdUrl||'':'';}
  const role=db.prepare('SELECT role FROM users WHERE id=?').get(userId)?.role;
  const recharge=pointRechargeAvailability(userId);
  return {balance,funded:pointsFromUnits(account.fundedUnits),bonus:pointsFromUnits(account.bonusUnits),withdrawable:pointsFromUnits(account.withdrawableUnits),canWithdraw:['developer','admin'].includes(role),tasksEnabled:siteFeatureAccess().tasks,tasks,claims,transactions,todayRewards,rechargeEnabled:recharge.enabled,rechargeProviders:recharge.providers,pointCurrency:'CNY',rechargeCnyFenPerPoint:100};
}

export function awardDailyAction(userId,code,sourceId=null,now=Date.now()){
  if(!siteFeatureAccess().tasks)return {awarded:0,balance:currentBalance(userId,now)};
  if (['daily_post','daily_comment'].includes(code) && !forumAccess().enabled) return {awarded:0,balance:currentBalance(userId,now)};
  return db.transaction(()=>{
    if(!siteFeatureAccess().tasks)return {awarded:0,balance:currentBalance(userId,now)};
    const task=db.prepare("SELECT code,reward_points FROM point_tasks WHERE code=? AND enabled=1 AND cadence='daily' AND review_mode='automatic'").get(code);
    if(!task||task.reward_points<=0)return {awarded:0,balance:currentBalance(userId,now)};
    if(sourceId!=null&&(db.prepare('SELECT 1 FROM point_reward_sources WHERE user_id=? AND task_code=? AND source_id=?').get(userId,code,sourceId)||db.prepare('SELECT 1 FROM point_asset_reward_sources WHERE user_id=? AND task_code=? AND source_id=?').get(userId,code,sourceId)))return {awarded:0,balance:currentBalance(userId,now)};
    const key=`daily:${code}:${userId}:${dayInShanghai(now)}`;
    if(db.prepare('SELECT 1 FROM point_transactions WHERE business_key=?').get(key)||db.prepare('SELECT 1 FROM point_asset_transactions WHERE business_key=?').get(key))return {awarded:0,balance:currentBalance(userId,now)};
    const result=writeBonusPoints(userId,task.reward_points,key,code,sourceId==null?{}:{sourceId},now);
    if(!result.replayed&&sourceId!=null)db.prepare('INSERT INTO point_asset_reward_sources(user_id,task_code,source_id,transaction_id) VALUES(?,?,?,?)').run(userId,code,sourceId,result.id);
    return {awarded:result.replayed?0:task.reward_points,balance:result.balance};
  }).immediate();
}

export function submitPointClaim(userId,taskId,{contactEmail='',customerId='',proofText=''},now=Date.now()){
  if(!siteFeatureAccess().tasks)throw new Error('POINT_TASKS_DISABLED');
  return db.transaction(()=>{
    if(!siteFeatureAccess().tasks)throw new Error('POINT_TASKS_DISABLED');
    const task=db.prepare("SELECT id,code,target_url targetUrl FROM point_tasks WHERE id=? AND enabled=1 AND review_mode='manual' AND cadence='once'").get(taskId);
    if(!task)throw new Error('TASK_UNAVAILABLE');
    if(['follow_x','join_telegram'].includes(task.code)&&!task.targetUrl){
      const key=task.code==='follow_x'?'socialXUrl':'telegramGroupUrl';
      if(!db.prepare('SELECT value FROM settings WHERE key=? AND length(trim(value))>0').get(key))throw new Error('TASK_LINK_UNAVAILABLE');
    }
    if(task.code==='tmgm_deposit'&&(!contactEmail||!customerId))throw new Error('BROKER_PROOF_REQUIRED');
    if(task.code!=='tmgm_deposit'&&!proofText)throw new Error('PROOF_REQUIRED');
    const previous=db.prepare('SELECT id,status FROM point_task_claims WHERE user_id=? AND task_id=?').get(userId,taskId);
    if(previous?.status==='pending'||previous?.status==='approved')throw new Error('CLAIM_EXISTS');
    if(previous){db.prepare(`UPDATE point_task_claims SET contact_email=?,customer_id=?,proof_text=?,status='pending',reviewer_note='',reviewed_by_user_id=NULL,reviewed_at=NULL,updated_at=? WHERE id=?`).run(contactEmail,customerId,proofText,now,previous.id);return previous.id;}
    return Number(db.prepare(`INSERT INTO point_task_claims(user_id,task_id,contact_email,customer_id,proof_text,created_at,updated_at) VALUES(?,?,?,?,?,?,?)`).run(userId,taskId,contactEmail,customerId,proofText,now,now).lastInsertRowid);
  }).immediate();
}

export function reviewPointClaim(adminId,claimId,approve,note='',now=Date.now()){
  return db.transaction(()=>{
    const claim=db.prepare(`SELECT c.*,t.code,t.reward_points FROM point_task_claims c JOIN point_tasks t ON t.id=c.task_id WHERE c.id=?`).get(claimId);
    if(!claim)throw new Error('CLAIM_NOT_FOUND');
    if(claim.status!=='pending')throw new Error('CLAIM_ALREADY_REVIEWED');
    if(approve&&claim.code==='tmgm_deposit'&&(!claim.contact_email||!claim.customer_id))throw new Error('BROKER_PROOF_REQUIRED');
    const result=approve&&claim.reward_points>0?writeBonusPoints(claim.user_id,claim.reward_points,`task:${claim.code}:${claim.user_id}`,claim.code,{claimId},now):null;
    db.prepare('UPDATE point_task_claims SET status=?,reviewer_note=?,reviewed_by_user_id=?,reviewed_at=?,updated_at=? WHERE id=?').run(approve?'approved':'rejected',note,adminId,now,now,claimId);
    notifyUser(claim.user_id,'task_review',approve?'积分任务审核通过':'积分任务已驳回',approve?`已发放 ${claim.reward_points} 积分。`:note,'/?route=points',now);
    return {status:approve?'approved':'rejected',awarded:result?.replayed?0:approve?claim.reward_points:0};
  }).immediate();
}

export function redeemWithPoints(user,productId,expectedPointsPrice,now=Date.now()){
  return db.transaction(()=>{
    if(!siteFeatureAccess().catalog)throw new Error('CATALOG_DISABLED');
    const product=db.prepare('SELECT id,author_user_id,price,points_price,status,deleted_at FROM products WHERE id=?').get(productId);
    if(!product||product.status!=='active'||product.deleted_at)throw new Error('PRODUCT_UNAVAILABLE');
    if(product.author_user_id===user.id)throw new Error('SELF_PURCHASE');
    if(!Number.isInteger(product.points_price)||product.points_price<=0||Number(product.price)<=0)throw new Error('POINT_PRICE_UNAVAILABLE');
    if(product.points_price!==expectedPointsPrice)throw new Error('POINT_PRICE_CHANGED');
    if(!getCurrentVersion(productId))throw new Error('VERSION_UNAVAILABLE');
    if(db.prepare('SELECT id FROM orders WHERE buyer_user_id=? AND product_id=?').get(user.id,productId))throw new Error('ALREADY_OWNED');
    const units=product.points_price*100;
    const debit=spendPointAssets(user.id,units,`redeem:${user.id}:${productId}`,{productId},now);
    const orderId=Number(db.prepare(`INSERT INTO orders(username,buyer_user_id,product_id,price,status,tx_hash,payment_verified,verified_at)
      VALUES(?,?,?,0,'completed',?,1,CURRENT_TIMESTAMP)`).run(user.username,user.id,productId,`POINTS:${crypto.randomUUID()}`).lastInsertRowid);
    const share=creditPointSale(product.author_user_id,orderId,debit.fundedSpent,debit.bonusSpent,now);
    db.prepare(`INSERT INTO point_asset_sales(order_id,buyer_user_id,developer_user_id,product_id,price_units,funded_spent_units,bonus_spent_units,creator_funded_units,creator_bonus_units,platform_funded_units,platform_bonus_units,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(orderId,user.id,product.author_user_id,productId,units,debit.fundedSpent,debit.bonusSpent,share.creatorFunded,share.creatorBonus,share.platformFunded,share.platformBonus,now);
    ensureOrderLicense(orderId);
    notifyUser(user.id,'purchase','EA 积分购买成功',`已使用 ${product.points_price} 积分获取策略。`,'/?route=profile',now);
    notifyUser(product.author_user_id,'sale','EA 策略售出',`已获得 ${pointsFromUnits(share.creatorFunded+share.creatorBonus)} 积分；其中 ${pointsFromUnits(share.creatorFunded)} 积分可提现。`,'/?route=points',now);
    return {orderId,spent:product.points_price,balance:debit.balance};
  }).immediate();
}

export function adminPendingCounts(){
  return {
      products: db.prepare("SELECT COUNT(*) count FROM products WHERE status='pending' AND deleted_at IS NULL").get().count,
      points: db.prepare("SELECT COUNT(*) count FROM point_task_claims WHERE status='pending'").get().count,
      pointWithdrawals: db.prepare("SELECT COUNT(*) count FROM point_asset_withdrawals WHERE status='pending'").get().count,
      reports: db.prepare("SELECT COUNT(*) count FROM content_reports WHERE status='pending'").get().count,
    };
}

export function adminPointOverview(){
  return {
    pendingCounts: adminPendingCounts(),
    tasks:db.prepare('SELECT id,code,title,description,reward_points rewardPoints,cadence,review_mode reviewMode,target_url targetUrl,proof_label proofLabel,enabled,is_system isSystem FROM point_tasks ORDER BY is_system DESC,id').all(),
    claims:db.prepare(`SELECT c.id,c.user_id userId,u.username,c.task_id taskId,t.title taskTitle,t.code,c.contact_email contactEmail,c.customer_id customerId,c.proof_text proofText,c.status,c.reviewer_note reviewerNote,c.created_at createdAt
      FROM point_task_claims c JOIN users u ON u.id=c.user_id JOIN point_tasks t ON t.id=c.task_id ORDER BY CASE c.status WHEN 'pending' THEN 0 ELSE 1 END,c.created_at DESC LIMIT 200`).all(),
  };
}

export function configurePointTask(id,{title,description,rewardPoints,targetUrl,proofLabel,enabled},now=Date.now()){
  const result=db.prepare(`UPDATE point_tasks SET title=?,description=?,reward_points=?,target_url=?,proof_label=?,enabled=?,updated_at=? WHERE id=?`).run(title,description,rewardPoints,targetUrl,proofLabel,enabled?1:0,now,id);
  if(result.changes!==1)throw new Error('TASK_NOT_FOUND');
}

export function createCustomPointTask({title,description,rewardPoints,targetUrl,proofLabel,enabled},now=Date.now()){
  const code=`custom_${crypto.randomUUID().replaceAll('-','').slice(0,24)}`;
  return Number(db.prepare(`INSERT INTO point_tasks(code,title,description,reward_points,cadence,review_mode,target_url,proof_label,enabled,is_system,created_at,updated_at)
    VALUES(?,?,?,?,'once','manual',?,?,?,0,?,?)`).run(code,title,description,rewardPoints,targetUrl,proofLabel,enabled?1:0,now,now).lastInsertRowid);
}
