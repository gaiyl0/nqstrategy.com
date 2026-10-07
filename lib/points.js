import crypto from 'node:crypto';
import db from './db.js';
import { ensureOrderLicense } from './licensing.js';
import { getCurrentVersion } from './product-versions.js';

const dayInShanghai = now => new Intl.DateTimeFormat('sv-SE', {
  timeZone:'Asia/Shanghai', year:'numeric', month:'2-digit', day:'2-digit',
}).format(new Date(now));

function account(userId,now=Date.now()) {
  db.prepare('INSERT OR IGNORE INTO point_accounts(user_id,balance,updated_at) VALUES(?,0,?)').run(userId,now);
  return db.prepare('SELECT balance FROM point_accounts WHERE user_id=?').get(userId);
}
function writePoints(userId,delta,businessKey,reason,metadata={},now=Date.now()) {
  const prior=db.prepare('SELECT id,user_id,delta,balance_after FROM point_transactions WHERE business_key=?').get(businessKey);
  if(prior){
    if(prior.user_id!==userId||prior.delta!==delta)throw new Error('POINT_KEY_CONFLICT');
    return {id:prior.id,balance:prior.balance_after,replayed:true};
  }
  const before=account(userId,now).balance;
  const after=before+delta;
  if(!Number.isSafeInteger(after)||after<0)throw new Error('INSUFFICIENT_POINTS');
  db.prepare('UPDATE point_accounts SET balance=?,updated_at=? WHERE user_id=?').run(after,now,userId);
  const result=db.prepare(`INSERT INTO point_transactions(user_id,delta,balance_after,business_key,reason,metadata,created_at)
    VALUES(?,?,?,?,?,?,?)`).run(userId,delta,after,businessKey,reason,JSON.stringify(metadata),now);
  return {id:Number(result.lastInsertRowid),balance:after,replayed:false};
}

export function pointState(userId){
  const balance=account(userId).balance;
  const tasks=db.prepare('SELECT id,code,title,description,reward_points rewardPoints,cadence,review_mode reviewMode,target_url targetUrl,proof_label proofLabel,enabled FROM point_tasks WHERE enabled=1 ORDER BY is_system DESC,id').all();
  const claims=db.prepare(`SELECT c.id,c.task_id taskId,t.code,c.status,c.contact_email contactEmail,c.customer_id customerId,c.proof_text proofText,c.reviewer_note reviewerNote,c.created_at createdAt,c.reviewed_at reviewedAt
    FROM point_task_claims c JOIN point_tasks t ON t.id=c.task_id WHERE c.user_id=? ORDER BY c.created_at DESC`).all(userId);
  const transactions=db.prepare('SELECT id,delta,balance_after balanceAfter,reason,created_at createdAt FROM point_transactions WHERE user_id=? ORDER BY id DESC LIMIT 40').all(userId);
  const today=dayInShanghai(Date.now());
  const todayRewards=db.prepare("SELECT reason FROM point_transactions WHERE user_id=? AND business_key LIKE ? AND delta>0").all(userId,`daily:%:${userId}:${today}`).map(row=>row.reason);
  const settings=Object.fromEntries(db.prepare("SELECT key,value FROM settings WHERE key IN ('socialXUrl','telegramGroupUrl','exchangeAdUrl')").all().map(row=>[row.key,row.value]));
  for(const task of tasks){if(!task.targetUrl)task.targetUrl=task.code==='follow_x'?settings.socialXUrl||'':task.code==='join_telegram'?settings.telegramGroupUrl||'':task.code==='tmgm_deposit'?settings.exchangeAdUrl||'':'';}
  return {balance,tasks,claims,transactions,todayRewards,rechargeEnabled:false};
}

export function awardDailyAction(userId,code,sourceId=null,now=Date.now()){
  return db.transaction(()=>{
    const task=db.prepare("SELECT code,reward_points FROM point_tasks WHERE code=? AND enabled=1 AND cadence='daily' AND review_mode='automatic'").get(code);
    if(!task||task.reward_points<=0)return {awarded:0,balance:account(userId,now).balance};
    if(sourceId!=null&&db.prepare('SELECT 1 FROM point_reward_sources WHERE user_id=? AND task_code=? AND source_id=?').get(userId,code,sourceId))return {awarded:0,balance:account(userId,now).balance};
    const key=`daily:${code}:${userId}:${dayInShanghai(now)}`;
    if(db.prepare('SELECT 1 FROM point_transactions WHERE business_key=?').get(key))return {awarded:0,balance:account(userId,now).balance};
    const result=writePoints(userId,task.reward_points,key,code,sourceId==null?{}:{sourceId},now);
    if(!result.replayed&&sourceId!=null)db.prepare('INSERT INTO point_reward_sources(user_id,task_code,source_id,transaction_id) VALUES(?,?,?,?)').run(userId,code,sourceId,result.id);
    return {awarded:result.replayed?0:task.reward_points,balance:result.balance};
  }).immediate();
}

export function submitPointClaim(userId,taskId,{contactEmail='',customerId='',proofText=''},now=Date.now()){
  return db.transaction(()=>{
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
    const result=approve&&claim.reward_points>0?writePoints(claim.user_id,claim.reward_points,`task:${claim.code}:${claim.user_id}`,claim.code,{claimId},now):null;
    db.prepare('UPDATE point_task_claims SET status=?,reviewer_note=?,reviewed_by_user_id=?,reviewed_at=?,updated_at=? WHERE id=?').run(approve?'approved':'rejected',note,adminId,now,now,claimId);
    return {status:approve?'approved':'rejected',awarded:result?.replayed?0:approve?claim.reward_points:0};
  }).immediate();
}

export function redeemWithPoints(user,productId,expectedPointsPrice,now=Date.now()){
  return db.transaction(()=>{
    const product=db.prepare('SELECT id,author_user_id,price,points_price,status,deleted_at FROM products WHERE id=?').get(productId);
    if(!product||product.status!=='active'||product.deleted_at)throw new Error('PRODUCT_UNAVAILABLE');
    if(product.author_user_id===user.id)throw new Error('SELF_PURCHASE');
    if(!Number.isInteger(product.points_price)||product.points_price<=0||Number(product.price)<=0)throw new Error('POINT_PRICE_UNAVAILABLE');
    if(product.points_price!==expectedPointsPrice)throw new Error('POINT_PRICE_CHANGED');
    if(!getCurrentVersion(productId))throw new Error('VERSION_UNAVAILABLE');
    if(db.prepare('SELECT id FROM orders WHERE buyer_user_id=? AND product_id=?').get(user.id,productId))throw new Error('ALREADY_OWNED');
    const debit=writePoints(user.id,-product.points_price,`redeem:${user.id}:${productId}`, 'strategy_redemption',{productId},now);
    const orderId=Number(db.prepare(`INSERT INTO orders(username,buyer_user_id,product_id,price,status,tx_hash,payment_verified,verified_at)
      VALUES(?,?,?,0,'completed',?,1,CURRENT_TIMESTAMP)`).run(user.username,user.id,productId,`POINTS:${crypto.randomUUID()}`).lastInsertRowid);
    db.prepare('INSERT INTO point_redemptions(order_id,user_id,product_id,points_spent,transaction_id,created_at) VALUES(?,?,?,?,?,?)').run(orderId,user.id,productId,product.points_price,debit.id,now);
    ensureOrderLicense(orderId);
    return {orderId,spent:product.points_price,balance:debit.balance};
  }).immediate();
}

export function adminPointOverview(){
  return {
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
