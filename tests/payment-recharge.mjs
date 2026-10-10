import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

process.env.NEXUS_DB_PATH=path.resolve(`.tmp-payment-recharge-${crypto.randomUUID()}.db`);
process.env.NEXUS_AUTO_MIGRATE='1';
process.env.POINT_RECHARGE_ENABLED='1';
const merchant=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
const platform=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
const alipayApp=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
const alipayPlatform=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
process.env.WECHAT_PAY_MERCHANT_CERTIFICATE_SERIAL='A'.repeat(40);
process.env.WECHAT_PAY_MERCHANT_PRIVATE_KEY=merchant.privateKey.export({type:'pkcs8',format:'pem'});
process.env.WECHAT_PAY_PLATFORM_CERTIFICATE=platform.publicKey.export({type:'spki',format:'pem'});
process.env.WECHAT_PAY_API_V3_KEY='0123456789abcdef0123456789abcdef';
process.env.ALIPAY_APP_PRIVATE_KEY=alipayApp.privateKey.export({type:'pkcs8',format:'pem'});
process.env.ALIPAY_PUBLIC_KEY=alipayPlatform.publicKey.export({type:'spki',format:'pem'});
const {default:db}=await import('../lib/db.js');
const {setRechargeExchangeRate}=await import('../lib/point-recharge.js');
const {createPointCheckout,pointRechargeOrder,reconcilePointRecharge,publicPointRechargeOrder,listOwnPointRecharges}=await import('../lib/point-payment-service.js');
const {pointAssetAccount}=await import('../lib/point-assets.js');
const {pointState}=await import('../lib/points.js');
const user=Number(db.prepare("INSERT INTO users(username,email,role,password) VALUES('recharge-buyer','recharge-buyer@example.com','user','hash')").run().lastInsertRowid);
const save=db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
for(const [key,value] of Object.entries({wechatPaySetupEnabled:'true',wechatPayMchId:'1900000109',wechatPayAppId:'wx123',
  wechatPayNotifyUrl:'https://nqstrategy.com/api/payments/webhooks/wechat-pay',wechatPayCertificateSerial:'B'.repeat(40),
  alipaySetupEnabled:'true',alipayAppId:'2026000000000000',alipaySellerId:'2088000000000000',
  alipayNotifyUrl:'https://nqstrategy.com/api/payments/webhooks/alipay',alipayGateway:'https://openapi.alipay.com/gateway.do'}))save.run(key,value);
// RMB checkout must work without a configured or fresh FX feed.
assert.equal(pointState(user).pointCurrency,'CNY');
setRechargeExchangeRate(725);
process.env.POINT_RECHARGE_ENABLED='0';
assert.equal(pointState(user).rechargeEnabled,false);
assert.deepEqual(pointState(user).rechargeProviders,[]);
process.env.POINT_RECHARGE_ENABLED='1';
process.env.POINT_RECHARGE_TEST_USER_IDS=String(user+1);
assert.equal(pointState(user).rechargeEnabled,false);
await assert.rejects(()=>createPointCheckout(user,1,'wechat',crypto.randomUUID(),async()=>new Response('{}')),/RECHARGE_DISABLED/);
process.env.POINT_RECHARGE_TEST_USER_IDS=String(user);
assert.equal(pointState(user).rechargeEnabled,true);
assert.deepEqual(pointState(user).rechargeProviders,['wechat','alipay']);
const nonce='0123456789abcdef0123456789abcdef';
const wechatReply=data=>{
  const raw=JSON.stringify(data),time=String(Math.floor(Date.now()/1000));
  return new Response(raw,{headers:{'wechatpay-timestamp':time,'wechatpay-nonce':nonce,'wechatpay-serial':'B'.repeat(40),
    'wechatpay-signature':crypto.sign('RSA-SHA256',Buffer.from(`${time}\n${nonce}\n${raw}\n`),platform.privateKey).toString('base64')}});
};
db.prepare("DELETE FROM settings WHERE key IN ('pointCnyFenPerUsd','pointRatePublishedDate')").run();
assert.deepEqual(pointState(user).rechargeProviders,['wechat','alipay']);
const wxCheckout=await createPointCheckout(user,10,'wechat',crypto.randomUUID(),async()=>wechatReply({code_url:'weixin://wxpay/bizpayurl?pr=offline'}));
assert.equal(wxCheckout.cnyFen,1000);
assert.equal(pointAssetAccount(user).fundedUnits,0,'an unsigned browser checkout must not credit points');
const wxOrder=pointRechargeOrder(wxCheckout.orderId,user);
const wxPaidTime=new Date(wxOrder.created_at+2000).toISOString();
const wxQuery={trade_state:'SUCCESS',mchid:'1900000109',appid:'wx123',out_trade_no:`NQPR${wxOrder.id}`,
  amount:{total:1000,currency:'CNY'},transaction_id:'42000000000000001',success_time:wxPaidTime};
const wxFetch=async()=>wechatReply(wxQuery);
await assert.rejects(()=>reconcilePointRecharge(wxOrder,{expectedTradeNo:'wrong',fetchImpl:wxFetch}),/RECHARGE_PAYMENT_MISMATCH/);
assert.equal(pointAssetAccount(user).fundedUnits,0);
assert.equal((await reconcilePointRecharge(wxOrder,{expectedTradeNo:wxQuery.transaction_id,fetchImpl:wxFetch})).replayed,false);
assert.equal((await reconcilePointRecharge(pointRechargeOrder(wxOrder.id),{expectedTradeNo:wxQuery.transaction_id,fetchImpl:wxFetch})).replayed,true);
assert.equal(pointAssetAccount(user).fundedUnits,1000,'signed query credits exactly once');
const aliReply=(key,value)=>{
  const node=JSON.stringify(value),signature=crypto.sign('RSA-SHA256',Buffer.from(node),alipayPlatform.privateKey).toString('base64');
  return new Response(JSON.stringify({[key]:value,sign:signature}));
};
const aliCheckout=await createPointCheckout(user,5,'alipay',crypto.randomUUID(),async()=>aliReply('alipay_trade_precreate_response',
  {code:'10000',out_trade_no:'NQPR2',qr_code:'https://qr.alipay.com/offline'}));
assert.equal(aliCheckout.cnyFen,500);
const aliOrder=pointRechargeOrder(aliCheckout.orderId,user);
const paidDate=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',
  hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(aliOrder.created_at+2000));
const aliQuery={code:'10000',out_trade_no:`NQPR${aliOrder.id}`,trade_no:'202610071000000001',total_amount:'5.00',
  seller_id:'2088000000000000',trade_status:'TRADE_SUCCESS',send_pay_date:paidDate};
const aliFetch=async()=>aliReply('alipay_trade_query_response',aliQuery);
assert.equal((await reconcilePointRecharge(aliOrder,{expectedTradeNo:aliQuery.trade_no,fetchImpl:aliFetch})).paid,true);
assert.equal(pointAssetAccount(user).fundedUnits,1500);
// Mobile orders remain pending until signed provider evidence settles them.
const mobileKey=crypto.randomUUID();
const mobile=await createPointCheckout(user,1.23,'alipay',mobileKey,()=>{throw Error('WAP must not call precreate');},'mobile');
const mobileUrl=new URL(mobile.payUrl),biz=JSON.parse(mobileUrl.searchParams.get('biz_content'));
assert.equal(mobileUrl.origin,'https://openapi.alipay.com');assert.equal(mobileUrl.searchParams.get('method'),'alipay.trade.wap.pay');
assert.equal(biz.product_code,'QUICK_WAP_WAY');assert.equal(biz.total_amount,'1.23');
assert.equal(new URL(mobileUrl.searchParams.get('return_url')).searchParams.get('rechargeOrder'),String(mobile.orderId));
assert.equal(pointAssetAccount(user).fundedUnits,1500,'generating WAP checkout does not credit points');
const replay=await createPointCheckout(user,1.23,'alipay',mobileKey,fetch,'mobile');assert.equal(replay.orderId,mobile.orderId);
await assert.rejects(()=>createPointCheckout(user,1,'wechat',crypto.randomUUID(),fetch,'mobile'),/RECHARGE_REQUEST_INVALID/);
const {financeOverview}=await import('../lib/finance-overview.js');
assert.throws(()=>financeOverview({role:'user'}),/FINANCE_FORBIDDEN/);
assert.throws(()=>financeOverview({role:'admin'},{view:'recharges;DROP TABLE users'}),/FINANCE_QUERY_INVALID/);
const finance=financeOverview({role:'admin'});
assert.equal(finance.summary.rechargeCny,15,'pending mobile order is excluded from revenue');
assert.equal(finance.summary.paidRecharges,2);
assert.equal(finance.items[0].id,mobile.orderId);assert.equal(finance.items[0].cny_fen,123);
assert.equal(financeOverview({role:'admin'},{userId:user+999}).items.length,0);
assert.equal(financeOverview({role:'admin'},{view:'points'}).items.length,2);
assert.equal(financeOverview({role:'admin'},{view:'sales'}).items.length,0);
assert.equal(financeOverview({role:'admin'},{view:'withdrawals'}).items.length,0);
const {applyPointAssetDelta}=await import('../lib/point-assets.js');
for(let i=0;i<51;i++)applyPointAssetDelta(user,{bonus:1},`finance-pagination:${i}`,'daily_checkin');
assert.equal(financeOverview({role:'admin'},{view:'points'}).items.length,50);
assert.equal(financeOverview({role:'admin'},{view:'points',page:2}).items.length,3);
assert.equal(financeOverview({role:'admin'},{view:'points',page:2}).pagination.total,53);
// Delayed evidence is accepted only when the signed payment happened before expiry.
const {createPointRechargeOrder}=await import('../lib/point-recharge.js');
const late=createPointRechargeOrder(user,2,'alipay',crypto.randomUUID(),Date.now()-20*60_000);
const lateOrder=pointRechargeOrder(late.id,user);
assert.equal(publicPointRechargeOrder(lateOrder).status,'expired');
const latePaidDate=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(lateOrder.created_at+2000));
const lateEvidence={...aliQuery,out_trade_no:`NQPR${late.id}`,trade_no:'202610071000000099',total_amount:'2.00',send_pay_date:latePaidDate};
const beforeLate=pointAssetAccount(user).fundedUnits;
assert.equal((await reconcilePointRecharge(lateOrder,{fetchImpl:async()=>aliReply('alipay_trade_query_response',lateEvidence)})).paid,true,'delayed verified on-time payment settles after local expiry');
await reconcilePointRecharge(pointRechargeOrder(late.id,user),{fetchImpl:async()=>aliReply('alipay_trade_query_response',lateEvidence)});
assert.equal(pointAssetAccount(user).fundedUnits,beforeLate+200,'late evidence credits once');
assert.equal(publicPointRechargeOrder(pointRechargeOrder(late.id,user)).status,'paid');
const other=Number(db.prepare("INSERT INTO users(username,email,role,password) VALUES('history-other','history-other@example.com','user','hash')").run().lastInsertRowid);
assert.throws(()=>pointRechargeOrder(late.id,other),/RECHARGE_ORDER_NOT_FOUND/);
assert.equal(listOwnPointRecharges(other).orders.length,0,'history cannot include another user');
for(let i=0;i<21;i++)createPointRechargeOrder(user,1,'alipay',crypto.randomUUID());
const firstHistory=listOwnPointRecharges(user),secondHistory=listOwnPointRecharges(user,2);
assert.equal(firstHistory.orders.length,20);assert.equal(firstHistory.pagination.total,25);assert.equal(secondHistory.orders.length,5);
assert.ok(firstHistory.orders[0].id>secondHistory.orders[0].id);
assert.equal(listOwnPointRecharges(user,999).pagination.page,2);
assert.throws(()=>listOwnPointRecharges(user,0),/RECHARGE_REQUEST_INVALID/);
assert.ok(!('request_key' in firstHistory.orders[0])&&!('user_id' in firstHistory.orders[0]));
const tooLate=createPointRechargeOrder(user,1,'alipay',crypto.randomUUID(),Date.now()-20*60_000);
const tooLateOrder=pointRechargeOrder(tooLate.id,user);
const beyondDate=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(tooLateOrder.expires_at+2000));
await assert.rejects(()=>reconcilePointRecharge(tooLateOrder,{fetchImpl:async()=>aliReply('alipay_trade_query_response',{...aliQuery,out_trade_no:`NQPR${tooLate.id}`,trade_no:'202610071000000098',total_amount:'1.00',send_pay_date:beyondDate})}),/RECHARGE_ORDER_NOT_PAYABLE/);
assert.equal(pointAssetAccount(user).fundedUnits,beforeLate+200,'payment beyond locked expiry must not credit');
const checked=spawnSync(process.execPath,['scripts/point-asset-maintenance.mjs'],{cwd:process.cwd(),env:process.env,encoding:'utf8'});
assert.equal(checked.status,0,checked.stdout+checked.stderr);
process.env.POINT_RECHARGE_ENABLED='0';
await assert.rejects(()=>createPointCheckout(user,1,'wechat',crypto.randomUUID(),async()=>wechatReply({code_url:'weixin://wxpay/bizpayurl?pr=offline'})),/RECHARGE_DISABLED/);
db.close();
console.log('Payment recharge integration passed: checkout, signed query, idempotent funding, provider matching and disabled-by-default gate');
