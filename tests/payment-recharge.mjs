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
const {createPointCheckout,pointRechargeOrder,reconcilePointRecharge}=await import('../lib/point-payment-service.js');
const {pointAssetAccount}=await import('../lib/point-assets.js');
const {pointState}=await import('../lib/points.js');
const user=Number(db.prepare("INSERT INTO users(username,email,role,password) VALUES('recharge-buyer','recharge-buyer@example.com','user','hash')").run().lastInsertRowid);
const save=db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
for(const [key,value] of Object.entries({wechatPaySetupEnabled:'true',wechatPayMchId:'1900000109',wechatPayAppId:'wx123',
  wechatPayNotifyUrl:'https://nqstrategy.com/api/payments/webhooks/wechat-pay',wechatPayCertificateSerial:'B'.repeat(40),
  alipaySetupEnabled:'true',alipayAppId:'2026000000000000',alipaySellerId:'2088000000000000',
  alipayNotifyUrl:'https://nqstrategy.com/api/payments/webhooks/alipay',alipayGateway:'https://openapi.alipay.com/gateway.do'}))save.run(key,value);
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
const wxCheckout=await createPointCheckout(user,10,'wechat',crypto.randomUUID(),async()=>wechatReply({code_url:'weixin://wxpay/bizpayurl?pr=offline'}));
assert.equal(wxCheckout.cnyFen,7250);
assert.equal(pointAssetAccount(user).fundedUnits,0,'an unsigned browser checkout must not credit points');
const wxOrder=pointRechargeOrder(wxCheckout.orderId,user);
const wxPaidTime=new Date(wxOrder.created_at+2000).toISOString();
const wxQuery={trade_state:'SUCCESS',mchid:'1900000109',appid:'wx123',out_trade_no:`NQPR${wxOrder.id}`,
  amount:{total:7250,currency:'CNY'},transaction_id:'42000000000000001',success_time:wxPaidTime};
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
assert.equal(aliCheckout.cnyFen,3625);
const aliOrder=pointRechargeOrder(aliCheckout.orderId,user);
const paidDate=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',
  hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(aliOrder.created_at+2000));
const aliQuery={code:'10000',out_trade_no:`NQPR${aliOrder.id}`,trade_no:'202610071000000001',total_amount:'36.25',
  seller_id:'2088000000000000',trade_status:'TRADE_SUCCESS',send_pay_date:paidDate};
const aliFetch=async()=>aliReply('alipay_trade_query_response',aliQuery);
assert.equal((await reconcilePointRecharge(aliOrder,{expectedTradeNo:aliQuery.trade_no,fetchImpl:aliFetch})).paid,true);
assert.equal(pointAssetAccount(user).fundedUnits,1500);
const checked=spawnSync(process.execPath,['scripts/point-asset-maintenance.mjs'],{cwd:process.cwd(),env:process.env,encoding:'utf8'});
assert.equal(checked.status,0,checked.stdout+checked.stderr);
process.env.POINT_RECHARGE_ENABLED='0';
await assert.rejects(()=>createPointCheckout(user,1,'wechat',crypto.randomUUID(),async()=>wechatReply({code_url:'weixin://wxpay/bizpayurl?pr=offline'})),/RECHARGE_DISABLED/);
db.close();
console.log('Payment recharge integration passed: checkout, signed query, idempotent funding, provider matching and disabled-by-default gate');
