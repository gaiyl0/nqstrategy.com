import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import {verifiedPayPalCapture} from '../lib/paypal-gateway.mjs';

process.env.NEXUS_DB_PATH=path.resolve(`.tmp-paypal-recharge-${crypto.randomUUID()}.db`);
process.env.NEXUS_AUTO_MIGRATE='1';
process.env.POINT_RECHARGE_ENABLED='1';
process.env.PAYPAL_RECHARGE_ENABLED='1';
process.env.PAYPAL_MODE='live';
process.env.PAYPAL_CLIENT_ID='sandbox-test-client';
process.env.PAYPAL_CLIENT_SECRET='sandbox-test-secret';
process.env.PAYPAL_MERCHANT_ID='SANDBOXMERCHANT1';

const {default:db}=await import('../lib/db.js');
const {pointAssetAccount}=await import('../lib/point-assets.js');
const {pointRechargeAvailability}=await import('../lib/point-payment-config.js');
const {createPayPalPointCheckout,capturePayPalPointCheckout}=await import('../lib/paypal-point-service.js');

const buyer=Number(db.prepare("INSERT INTO users(username,email,role,password) VALUES('paypal-buyer','paypal-buyer@example.com','user','hash')").run().lastInsertRowid);
const other=Number(db.prepare("INSERT INTO users(username,email,role,password) VALUES('paypal-other','paypal-other@example.com','user','hash')").run().lastInsertRowid);
assert.deepEqual(pointRechargeAvailability(buyer).providers,['paypal'],'USD checkout does not depend on CNY exchange feed');
let paypalId='PAYPALORDER000001';
let captureId='PAYPALCAPTURE0001';
let orderCount=0,captureCount=0;
let badMerchant=false,badAmount=false;
let localId=0;
const fetchImpl=async(url,options)=>{
  assert.ok(url.startsWith(process.env.PAYPAL_MODE==='sandbox'?'https://api-m.sandbox.paypal.com/':'https://api-m.paypal.com/'));
  assert.equal(options.redirect,'error');
  if(url.endsWith('/v1/oauth2/token')){
    assert.ok(options.headers.Authorization.startsWith('Basic '));
    return Response.json({access_token:'A'.repeat(30)});
  }
  assert.equal(options.headers.Authorization,`Bearer ${'A'.repeat(30)}`);
  if(url.endsWith('/v2/checkout/orders')){
    orderCount++;
    const body=JSON.parse(options.body);
    assert.equal(body.purchase_units[0].amount.value,'2.50');
    assert.equal(body.purchase_units[0].amount.currency_code,'USD');
    assert.equal(body.purchase_units[0].payee.merchant_id,'SANDBOXMERCHANT1');
    localId=Number(body.purchase_units[0].custom_id.slice(4));
    assert.equal(options.headers['PayPal-Request-Id'],`NQPP-CREATE-${localId}`);
    return Response.json({id:paypalId,status:'CREATED'});
  }
  if(url.endsWith(`/${paypalId}`))return Response.json({id:paypalId,status:'APPROVED'});
  if(url.endsWith(`/${paypalId}/capture`)){
    captureCount++;
    assert.equal(options.headers['PayPal-Request-Id'],`NQPP-CAPTURE-${localId}`);
    return Response.json({id:paypalId,status:'COMPLETED',purchase_units:[{
      payments:{captures:[{id:captureId,status:'COMPLETED',
        amount:{currency_code:'USD',value:badAmount?'2.49':'2.50'},payee:{merchant_id:badMerchant?'WRONG':'SANDBOXMERCHANT1'},
        create_time:new Date(Date.now()).toISOString()}]}}]});
  }
  throw new Error(`unexpected PayPal URL ${url}`);
};

const key=crypto.randomUUID();
const checkout=await createPayPalPointCheckout(buyer,2.5,key,fetchImpl);
localId=checkout.orderId;
assert.equal(checkout.paypalOrderId,paypalId);
assert.equal(checkout.usdCents,250);
assert.equal(orderCount,1);
assert.equal((await createPayPalPointCheckout(buyer,2.5,key,fetchImpl)).paypalOrderId,paypalId);
assert.equal(orderCount,1,'idempotent retry cannot create another PayPal order');
await assert.rejects(createPayPalPointCheckout(other,2.5,key,fetchImpl),/RECHARGE_KEY_CONFLICT/);
await assert.rejects(capturePayPalPointCheckout(other,localId,paypalId,fetchImpl),/PAYPAL_ORDER_NOT_FOUND/);
await assert.rejects(capturePayPalPointCheckout(buyer,localId,'DIFFERENTORDER123',fetchImpl),/PAYPAL_ORDER_MISMATCH/);
badMerchant=true;
await assert.rejects(capturePayPalPointCheckout(buyer,localId,paypalId,fetchImpl),/PAYPAL_CAPTURE_NOT_VERIFIED/);
assert.equal(pointAssetAccount(buyer).fundedUnits,0);
badMerchant=false;badAmount=true;
await assert.rejects(capturePayPalPointCheckout(buyer,localId,paypalId,fetchImpl),/PAYPAL_CAPTURE_NOT_VERIFIED/);
assert.equal(pointAssetAccount(buyer).fundedUnits,0);
badAmount=false;
const settled=await capturePayPalPointCheckout(buyer,localId,paypalId,fetchImpl);
assert.equal(settled.points,2.5);
assert.equal(settled.replayed,false);
assert.equal(pointAssetAccount(buyer).fundedUnits,250);
assert.equal((await capturePayPalPointCheckout(buyer,localId,paypalId,fetchImpl)).replayed,true);
assert.equal(captureCount,3,'paid replay never calls PayPal again');
assert.equal(db.prepare('SELECT COUNT(*) n FROM point_asset_transactions WHERE business_key=?').get(`paypal-recharge:${localId}`).n,1);
const row=db.prepare('SELECT * FROM paypal_point_recharge_orders WHERE id=?').get(localId);
assert.throws(()=>verifiedPayPalCapture({id:paypalId,status:'COMPLETED',purchase_units:[]},row,'SANDBOXMERCHANT1'),/PAYPAL_CAPTURE_NOT_VERIFIED/);
const minimalCompleted={id:paypalId,status:'COMPLETED',purchase_units:[{payments:{captures:[{
  id:captureId,status:'COMPLETED',amount:{currency_code:'USD',value:'2.50'},create_time:new Date(row.paid_at).toISOString(),
}]}}]};
assert.equal(verifiedPayPalCapture(minimalCompleted,row,'SANDBOXMERCHANT1').captureId,captureId,
  'PayPal responses may omit purchase-unit metadata and payee while retaining the completed capture');
assert.throws(()=>verifiedPayPalCapture({...minimalCompleted,purchase_units:[{...minimalCompleted.purchase_units[0],custom_id:'WRONG'}]},row,'SANDBOXMERCHANT1'),/PAYPAL_CAPTURE_NOT_VERIFIED/);

process.env.PAYPAL_MODE='sandbox';
paypalId='PAYPALORDER000002';captureId='PAYPALCAPTURE0002';
const sandboxCheckout=await createPayPalPointCheckout(buyer,2.5,crypto.randomUUID(),fetchImpl);
const sandboxSettlement=await capturePayPalPointCheckout(buyer,sandboxCheckout.orderId,paypalId,fetchImpl);
assert.equal(sandboxSettlement.testMode,true);
assert.equal(pointAssetAccount(buyer).fundedUnits,250,'sandbox payments never credit real funded points');
assert.equal(db.prepare('SELECT COUNT(*) n FROM point_asset_transactions WHERE business_key=?').get(`paypal-recharge:${sandboxCheckout.orderId}`).n,0);

process.env.PAYPAL_RECHARGE_ENABLED='0';
assert.deepEqual(pointRechargeAvailability(buyer).providers,[]);
await assert.rejects(createPayPalPointCheckout(buyer,2.5,crypto.randomUUID(),fetchImpl),/PAYPAL_PAYMENT_CONFIG_UNAVAILABLE/);
console.log('PayPal recharge tests passed: USD order, merchant/amount verification, ownership, idempotency, optional response fields, sandbox asset isolation and disabled gate');
db.close();
