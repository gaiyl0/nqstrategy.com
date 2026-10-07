import db from './db.js';
import {createPointRechargeOrder,refreshAutomaticRechargeRate,settleVerifiedPointRecharge} from './point-recharge.js';
import {pointCheckoutEnabled,wechatPaymentConfig,alipayPaymentConfig} from './point-payment-config.js';
import {createWechatNativeOrder,queryWechatNativeOrder} from './wechat-pay-gateway.mjs';
import {createAlipayQrOrder,queryAlipayOrder} from './alipay-gateway.mjs';

export function pointRechargeOrder(orderId,userId=null) {
  if(!Number.isSafeInteger(orderId)||orderId<=0)throw new Error('RECHARGE_ORDER_NOT_FOUND');
  const row=userId===null?db.prepare('SELECT * FROM point_recharge_orders WHERE id=?').get(orderId)
    :db.prepare('SELECT * FROM point_recharge_orders WHERE id=? AND user_id=?').get(orderId,userId);
  if(!row)throw new Error('RECHARGE_ORDER_NOT_FOUND');
  return row;
}

export function rechargeIdFromTradeNo(outTradeNo) {
  const matched=/^NQPR([1-9]\d{0,14})$/.exec(outTradeNo||'');
  const orderId=matched?Number(matched[1]):0;
  if(!Number.isSafeInteger(orderId)||orderId<=0)throw new Error('RECHARGE_ORDER_NOT_FOUND');
  return orderId;
}

export async function createPointCheckout(userId,points,provider,requestKey,fetchImpl=fetch) {
  if(!pointCheckoutEnabled(userId))throw new Error('RECHARGE_DISABLED');
  await refreshAutomaticRechargeRate().catch(()=>{throw new Error('RECHARGE_RATE_UNSET');});
  const config=provider==='wechat'?wechatPaymentConfig():provider==='alipay'?alipayPaymentConfig():null;
  if(!config)throw new Error('RECHARGE_REQUEST_INVALID');
  const created=createPointRechargeOrder(userId,points,provider,requestKey);
  const order=pointRechargeOrder(created.id,userId);
  if(order.status!=='pending'||order.expires_at<=Date.now())throw new Error('RECHARGE_ORDER_NOT_PAYABLE');
  const checkout=provider==='wechat'?await createWechatNativeOrder(order,config,fetchImpl):await createAlipayQrOrder(order,config,fetchImpl);
  return {...checkout,points:order.points_units/100,cnyFen:order.cny_fen,cnyFenPerUsd:order.cny_fen_per_usd,
    provider,status:order.status,replayed:created.replayed};
}

export async function reconcilePointRecharge(order,{expectedTradeNo=null,fetchImpl=fetch}={}) {
  const config=order.provider==='wechat'?wechatPaymentConfig():order.provider==='alipay'?alipayPaymentConfig():null;
  if(!config)throw new Error('RECHARGE_REQUEST_INVALID');
  const result=order.provider==='wechat'?await queryWechatNativeOrder(order,config,fetchImpl):await queryAlipayOrder(order,config,fetchImpl);
  if(!result.settlement)return {orderId:order.id,state:result.state,paid:false};
  if(expectedTradeNo&&result.settlement.providerTradeNo!==expectedTradeNo)throw new Error('RECHARGE_PAYMENT_MISMATCH');
  const settled=settleVerifiedPointRecharge(result.settlement);
  return {...settled,state:result.state,paid:true};
}
