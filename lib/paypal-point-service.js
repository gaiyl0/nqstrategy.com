import db from './db.js';
import {applyPointAssetDelta,pointsFromUnits} from './point-assets.js';
import {notifyUser} from './inbox.js';
import {pointCheckoutEnabled,paypalPaymentConfig} from './point-payment-config.js';
import {capturePayPalOrder,createPayPalOrder,getPayPalOrder,verifiedPayPalCapture} from './paypal-gateway.mjs';

export function paypalPointOrder(id,userId){
  if(!Number.isSafeInteger(id)||id<=0)throw new Error('PAYPAL_ORDER_NOT_FOUND');
  const row=db.prepare('SELECT * FROM paypal_point_recharge_orders WHERE id=? AND user_id=?').get(id,userId);
  if(!row)throw new Error('PAYPAL_ORDER_NOT_FOUND');
  return row;
}

export async function createPayPalPointCheckout(userId,points,requestKey,fetchImpl=fetch){
  if(!pointCheckoutEnabled(userId))throw new Error('RECHARGE_DISABLED');
  const config=paypalPaymentConfig();
  const units=Math.round(points*100);
  if(!Number.isSafeInteger(units)||units<100||units>100000000||Math.abs(points*100-units)>0.000001||
    !/^[a-f0-9-]{36}$/i.test(requestKey||''))throw new Error('PAYPAL_REQUEST_INVALID');
  const now=Date.now();
  const local=db.transaction(()=>{
    const existing=db.prepare('SELECT * FROM paypal_point_recharge_orders WHERE request_key=?').get(requestKey);
    if(existing){
      if(existing.user_id!==userId||existing.points_units!==units||existing.mode!==config.mode)throw new Error('RECHARGE_KEY_CONFLICT');
      return existing;
    }
    const id=Number(db.prepare(`INSERT INTO paypal_point_recharge_orders(user_id,mode,points_units,usd_cents,request_key,created_at,expires_at)
      VALUES(?,?,?,?,?,?,?)`).run(userId,config.mode,units,units,requestKey,now,now+30*60*1000).lastInsertRowid);
    return paypalPointOrder(id,userId);
  }).immediate();
  if(local.status!=='pending'||local.expires_at<=Date.now())throw new Error('PAYPAL_ORDER_NOT_PAYABLE');
  let paypalOrderId=local.paypal_order_id;
  if(!paypalOrderId){
    paypalOrderId=await createPayPalOrder(local,config,fetchImpl);
    const updated=db.prepare('UPDATE paypal_point_recharge_orders SET paypal_order_id=? WHERE id=? AND paypal_order_id IS NULL')
      .run(paypalOrderId,local.id);
    if(updated.changes!==1&&paypalPointOrder(local.id,userId).paypal_order_id!==paypalOrderId)throw new Error('PAYPAL_ORDER_CONFLICT');
  }
  return {orderId:local.id,paypalOrderId,points:pointsFromUnits(units),usdCents:units,
    status:'pending',expiresAt:local.expires_at,clientId:config.clientId,mode:config.mode};
}

function settlePayPalPointOrder(order,verified){
  return db.transaction(()=>{
    const current=paypalPointOrder(order.id,order.user_id);
    if(current.status==='paid'){
      if(current.capture_id!==verified.captureId)throw new Error('PAYPAL_CAPTURE_CONFLICT');
      return {orderId:order.id,points:pointsFromUnits(order.points_units),replayed:true,testMode:order.mode==='sandbox'};
    }
    if(current.status!=='pending'||current.paypal_order_id!==order.paypal_order_id||
      current.usd_cents!==verified.usdCents||
      db.prepare('SELECT id FROM paypal_point_recharge_orders WHERE capture_id=?').get(verified.captureId))
      throw new Error('PAYPAL_CAPTURE_CONFLICT');
    const updated=db.prepare("UPDATE paypal_point_recharge_orders SET status='paid',capture_id=?,paid_at=? WHERE id=? AND status='pending'")
      .run(verified.captureId,verified.paidAt,order.id);
    if(updated.changes!==1)throw new Error('PAYPAL_CAPTURE_CONFLICT');
    if(order.mode==='live'){
      applyPointAssetDelta(order.user_id,{funded:order.points_units},`paypal-recharge:${order.id}`,'verified_recharge',
        {orderId:order.id,provider:'paypal',captureId:verified.captureId,usdCents:verified.usdCents},verified.paidAt);
      notifyUser(order.user_id,'points','PayPal 充值积分到账',`${pointsFromUnits(order.points_units)} 积分已到账。`,'/?route=points',Date.now());
    }
    return {orderId:order.id,points:pointsFromUnits(order.points_units),replayed:false,testMode:order.mode==='sandbox'};
  }).immediate();
}

export async function capturePayPalPointCheckout(userId,id,paypalOrderId,fetchImpl=fetch){
  if(!pointCheckoutEnabled(userId))throw new Error('RECHARGE_DISABLED');
  const order=paypalPointOrder(id,userId);
  if(order.paypal_order_id!==paypalOrderId||!paypalOrderId)throw new Error('PAYPAL_ORDER_MISMATCH');
  if(order.status==='paid')return {orderId:id,points:pointsFromUnits(order.points_units),replayed:true,testMode:order.mode==='sandbox'};
  const config=paypalPaymentConfig();
  if(order.mode!==config.mode)throw new Error('PAYPAL_ORDER_MISMATCH');
  let remote=await getPayPalOrder(paypalOrderId,config,fetchImpl);
  if(remote.status==='APPROVED'){
    if(order.expires_at<=Date.now())throw new Error('PAYPAL_ORDER_NOT_PAYABLE');
    remote=await capturePayPalOrder(paypalOrderId,id,config,fetchImpl);
  }
  const verified=verifiedPayPalCapture(remote,order,config.merchantId);
  return settlePayPalPointOrder(order,verified);
}
