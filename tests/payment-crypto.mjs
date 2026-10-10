import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { signWechatRequest, verifyWechatResponse, decryptWechatNotificationResource, verifiedWechatTrade } from '../lib/wechat-pay-crypto.mjs';
import { createWechatNativeOrder, queryWechatNativeOrder } from '../lib/wechat-pay-gateway.mjs';
import {alipayCanonical,signAlipayParameters,verifyAlipayNotification,verifyAlipayResponse,verifiedAlipayTrade,
  createAlipayQrOrder,createAlipayMobileOrder,queryAlipayOrder,yuanToFen} from '../lib/alipay-gateway.mjs';

const merchant=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
const platform=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
const nonce='0123456789abcdef0123456789abcdef';
const timestamp=1700000000;
const body='{"appid":"wx123","amount":{"total":7250}}';
const auth=signWechatRequest({method:'POST',pathname:'/v3/pay/transactions/native',body,merchantId:'1900000109',merchantCertificateSerial:'A'.repeat(40),merchantPrivateKey:merchant.privateKey,nonce,timestamp});
const signature=auth.match(/signature="([^"]+)"/)?.[1];
assert.ok(signature);
assert.equal(crypto.verify('RSA-SHA256',Buffer.from(`POST\n/v3/pay/transactions/native\n${timestamp}\n${nonce}\n${body}\n`),merchant.publicKey,Buffer.from(signature,'base64')),true);
const responseBody='{"trade_state":"SUCCESS"}';
const responseHeaders=new Headers({
  'wechatpay-timestamp':String(timestamp),'wechatpay-nonce':nonce,'wechatpay-serial':'B'.repeat(40),
  'wechatpay-signature':crypto.sign('RSA-SHA256',Buffer.from(`${timestamp}\n${nonce}\n${responseBody}\n`),platform.privateKey).toString('base64'),
});
assert.equal(verifyWechatResponse({headers:responseHeaders,body:responseBody,platformCertificateSerial:'B'.repeat(40),platformCertificate:platform.publicKey,now:timestamp*1000}),true);
assert.throws(()=>verifyWechatResponse({headers:responseHeaders,body:responseBody+' ',platformCertificateSerial:'B'.repeat(40),platformCertificate:platform.publicKey,now:timestamp*1000}),/WECHAT_SIGNATURE_INVALID/);
assert.throws(()=>verifyWechatResponse({headers:responseHeaders,body:responseBody,platformCertificateSerial:'C'.repeat(40),platformCertificate:platform.publicKey,now:timestamp*1000}),/WECHAT_SIGNATURE_INVALID/);
assert.throws(()=>verifyWechatResponse({headers:responseHeaders,body:responseBody,platformCertificateSerial:'B'.repeat(40),platformCertificate:platform.publicKey,now:(timestamp+301)*1000}),/WECHAT_SIGNATURE_INVALID/);
const key='0123456789abcdef0123456789abcdef';
const iv='abcdefghijkl';
const associated='resource';
const cipher=crypto.createCipheriv('aes-256-gcm',Buffer.from(key),Buffer.from(iv));
cipher.setAAD(Buffer.from(associated));
const ciphertext=Buffer.concat([cipher.update(Buffer.from(responseBody)),cipher.final(),cipher.getAuthTag()]).toString('base64');
assert.deepEqual(decryptWechatNotificationResource({algorithm:'AEAD_AES_256_GCM',nonce:iv,associated_data:associated,ciphertext},key),{trade_state:'SUCCESS'});
assert.throws(()=>decryptWechatNotificationResource({algorithm:'AEAD_AES_256_GCM',nonce:iv,associated_data:'wrong',ciphertext},key),/WECHAT_RESOURCE_INVALID/);
const cipherWithoutAAD=crypto.createCipheriv('aes-256-gcm',Buffer.from(key),Buffer.from(iv));
const ciphertextWithoutAAD=Buffer.concat([cipherWithoutAAD.update(Buffer.from(responseBody)),cipherWithoutAAD.final(),cipherWithoutAAD.getAuthTag()]).toString('base64');
assert.deepEqual(decryptWechatNotificationResource({algorithm:'AEAD_AES_256_GCM',nonce:iv,ciphertext:ciphertextWithoutAAD},key),{trade_state:'SUCCESS'});
const query={trade_state:'SUCCESS',mchid:'1900000109',appid:'wx123',out_trade_no:'NQPR123',amount:{total:7250,currency:'CNY'},transaction_id:'42000000000000001',success_time:'2026-10-07T10:00:00+08:00'};
assert.deepEqual(verifiedWechatTrade(query,{merchantId:'1900000109',appId:'wx123',outTradeNo:'NQPR123',cnyFen:7250,orderId:12}),{orderId:12,provider:'wechat',providerTradeNo:'42000000000000001',cnyFen:7250,paidAt:Date.parse(query.success_time)});
assert.throws(()=>verifiedWechatTrade({...query,amount:{...query.amount,total:7251}},{merchantId:'1900000109',appId:'wx123',outTradeNo:'NQPR123',cnyFen:7250,orderId:12}),/WECHAT_TRADE_MISMATCH/);
const config={merchantId:'1900000109',appId:'wx123',merchantCertificateSerial:'A'.repeat(40),merchantPrivateKey:merchant.privateKey,
  platformCertificateSerial:'B'.repeat(40),platformCertificate:platform.publicKey,notifyUrl:'https://nqstrategy.com/api/payments/webhooks/wechat-pay'};
const order={id:123,provider:'wechat',status:'pending',cny_fen:7250,expires_at:Date.now()+15*60_000};
let sent;
const reply=value=>{
  const raw=JSON.stringify(value);
  const time=String(Math.floor(Date.now()/1000));
  return new Response(raw,{status:200,headers:{'wechatpay-timestamp':time,'wechatpay-nonce':nonce,'wechatpay-serial':'B'.repeat(40),
    'wechatpay-signature':crypto.sign('RSA-SHA256',Buffer.from(`${time}\n${nonce}\n${raw}\n`),platform.privateKey).toString('base64')}});
};
const native=await createWechatNativeOrder(order,config,async(url,options)=>{sent={url,options};return reply({code_url:'weixin://wxpay/bizpayurl?pr=test'});});
assert.equal(native.codeUrl,'weixin://wxpay/bizpayurl?pr=test');
assert.equal(sent.url,'https://api.mch.weixin.qq.com/v3/pay/transactions/native');
assert.deepEqual(JSON.parse(sent.options.body).amount,{total:7250,currency:'CNY'});
assert.equal(JSON.parse(sent.options.body).out_trade_no,'NQPR123');
const queryResult=await queryWechatNativeOrder(order,config,async(url,options)=>{sent={url,options};return reply({...query,out_trade_no:'NQPR123'});});
assert.equal(queryResult.settlement.cnyFen,7250);
assert.match(sent.url,/out-trade-no\/NQPR123\?mchid=1900000109$/);
await assert.rejects(()=>queryWechatNativeOrder(order,config,async()=>reply({...query,out_trade_no:'NQPR999'})),/WECHAT_TRADE_MISMATCH/);
await assert.rejects(()=>queryWechatNativeOrder(order,config,async()=>new Response('{}',{status:200})),/WECHAT_SIGNATURE_INVALID/);
const alipayKeys=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
const appKeys=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
const notification={app_id:'2026000000000000',charset:'utf-8',sign_type:'RSA2',seller_id:'2088000000000000',out_trade_no:'NQPR12',total_amount:'72.50',trade_status:'TRADE_SUCCESS'};
notification.sign=crypto.sign('RSA-SHA256',Buffer.from(alipayCanonical(notification)),alipayKeys.privateKey).toString('base64');
assert.equal(verifyAlipayNotification(notification,alipayKeys.publicKey),true);
assert.throws(()=>verifyAlipayNotification({...notification,total_amount:'72.51'},alipayKeys.publicKey),/ALIPAY_SIGNATURE_INVALID/);
const signedRequest={app_id:'2026000000000000',method:'alipay.trade.query',charset:'utf-8',sign_type:'RSA2',biz_content:'{"out_trade_no":"NQPR12"}'};
assert.equal(crypto.verify('RSA-SHA256',Buffer.from('app_id=2026000000000000&biz_content={"out_trade_no":"NQPR12"}&charset=utf-8&method=alipay.trade.query&sign_type=RSA2'),appKeys.publicKey,
  Buffer.from(signAlipayParameters(signedRequest,appKeys.privateKey),'base64')),true);
const aliNode={code:'10000',out_trade_no:'NQPR12',trade_no:'202610071000000001',total_amount:'72.50',seller_id:'2088000000000000',
  trade_status:'TRADE_SUCCESS',send_pay_date:'2026-10-07 10:00:00'};
const signedAlipayResponse=(key,node)=>{
  const rawNode=JSON.stringify(node);
  const signature=crypto.sign('RSA-SHA256',Buffer.from(rawNode),alipayKeys.privateKey).toString('base64');
  return JSON.stringify({[key]:node,sign:signature});
};
const queryRaw=signedAlipayResponse('alipay_trade_query_response',aliNode);
assert.deepEqual(verifyAlipayResponse(queryRaw,'alipay_trade_query_response',alipayKeys.publicKey),aliNode);
assert.throws(()=>verifyAlipayResponse(queryRaw.replace('72.50','72.51'),'alipay_trade_query_response',alipayKeys.publicKey),/ALIPAY_SIGNATURE_INVALID/);
assert.equal(yuanToFen('72.50'),7250);
assert.throws(()=>yuanToFen('72.501'),/ALIPAY_AMOUNT_INVALID/);
assert.deepEqual(verifiedAlipayTrade(aliNode,{appId:'2026000000000000',sellerId:'2088000000000000',outTradeNo:'NQPR12',cnyFen:7250,orderId:12}),
  {orderId:12,provider:'alipay',providerTradeNo:aliNode.trade_no,cnyFen:7250,paidAt:Date.parse('2026-10-07T10:00:00+08:00')});
const aliConfig={appId:'2026000000000000',sellerId:'2088000000000000',privateKey:appKeys.privateKey,publicKey:alipayKeys.publicKey,
  notifyUrl:'https://nqstrategy.com/api/payments/webhooks/alipay',gateway:'https://openapi.alipay.com/gateway.do'};
const aliOrder={id:12,provider:'alipay',status:'pending',cny_fen:7250,expires_at:Date.now()+900000};
const aliQr=await createAlipayQrOrder(aliOrder,aliConfig,async(url,options)=>{
  assert.equal(url,aliConfig.gateway);assert.equal(options.redirect,'error');
  const form=new URLSearchParams(options.body);
  assert.equal(JSON.parse(form.get('biz_content')).total_amount,'72.50');
  return new Response(signedAlipayResponse('alipay_trade_precreate_response',{code:'10000',out_trade_no:'NQPR12',qr_code:'https://qr.alipay.com/test'}));
});
assert.equal(aliQr.codeUrl,'https://qr.alipay.com/test');
const aliQuery=await queryAlipayOrder(aliOrder,aliConfig,async()=>new Response(queryRaw));
assert.equal(aliQuery.settlement.cnyFen,7250);
await assert.rejects(()=>queryAlipayOrder(aliOrder,{...aliConfig,gateway:'https://evil.example/gateway.do'},async()=>new Response(queryRaw)),/ALIPAY_PAYMENT_CONFIG_UNAVAILABLE/);
const wap=createAlipayMobileOrder(aliOrder,aliConfig);
const wapParams=Object.fromEntries(new URL(wap.payUrl).searchParams),wapSign=wapParams.sign;delete wapParams.sign;
const wapCanonical=Object.keys(wapParams).sort().map(key=>`${key}=${wapParams[key]}`).join('&');
assert.equal(crypto.verify('RSA-SHA256',Buffer.from(wapCanonical),appKeys.publicKey,Buffer.from(wapSign,'base64')),true,'WAP payload includes sign_type in its independently verified signature');
assert.equal(new URL(wapParams.return_url).origin,'https://nqstrategy.com');
assert.throws(()=>createAlipayMobileOrder({...aliOrder,expires_at:Date.now()-1},aliConfig),/ALIPAY_ORDER_INVALID/);
assert.throws(()=>createAlipayMobileOrder(aliOrder,{...aliConfig,gateway:'https://evil.example/'}),/ALIPAY_PAYMENT_CONFIG_UNAVAILABLE/);
const nearlyExpiredWap=createAlipayMobileOrder({...aliOrder,expires_at:Date.now()+180000},aliConfig);
assert.equal(JSON.parse(new URL(nearlyExpiredWap.payUrl).searchParams.get('biz_content')).timeout_express,'2m','retry cannot extend payment beyond local expiry');
console.log('Payment cryptography tests passed: signed WeChat and Alipay requests, replies, tampering, amounts and trade queries');
