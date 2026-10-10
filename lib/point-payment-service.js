import db from './db.js';
import {createPointRechargeOrder,settleVerifiedPointRecharge} from './point-recharge.js';
import {pointCheckoutEnabled,wechatPaymentConfig,alipayPaymentConfig} from './point-payment-config.js';
import {createWechatNativeOrder,queryWechatNativeOrder} from './wechat-pay-gateway.mjs';
import {createAlipayQrOrder,createAlipayMobileOrder,queryAlipayOrder} from './alipay-gateway.mjs';

export function pointRechargeOrder(orderId,userId=null) {
  if(!Number.isSafeInteger(orderId)||orderId<=0)throw new Error('RECHARGE_ORDER_NOT_FOUND');
  const row=userId===null?db.prepare('SELECT * FROM point_recharge_orders WHERE id=?').get(orderId)
    :db.prepare('SELECT * FROM point_recharge_orders WHERE id=? AND user_id=?').get(orderId,userId);
  if(!row)throw new Error('RECHARGE_ORDER_NOT_FOUND');
  return row;
}

// Only return fields needed by the owner; never expose request keys or other users.
export function publicPointRechargeOrder(order,now=Date.now()) {
  return {id:order.id,provider:order.provider,points:order.points_units/100,cnyFen:order.cny_fen,
    currency:'CNY',cnyFenPerPoint:order.cny_fen_per_usd,
    status:order.status==='pending'&&order.expires_at<=now?'expired':order.status,
    createdAt:order.created_at,expiresAt:order.expires_at,paidAt:order.paid_at,
    tradeNo:order.provider_trade_no||null};
}

export function listOwnPointRecharges(userId,page=1) {
  if(!Number.isSafeInteger(userId)||userId<1||!Number.isSafeInteger(page)||page<1||page>1000000)throw new Error('RECHARGE_REQUEST_INVALID');
  const total=db.prepare('SELECT COUNT(*) n FROM point_recharge_orders WHERE user_id=?').get(userId).n;
  const totalPages=Math.max(1,Math.ceil(total/20)),currentPage=Math.min(page,totalPages);
  const rows=db.prepare('SELECT * FROM point_recharge_orders WHERE user_id=? ORDER BY id DESC LIMIT 20 OFFSET ?').all(userId,(currentPage-1)*20);
  return {orders:rows.map(row=>publicPointRechargeOrder(row)),pagination:{page:currentPage,pageSize:20,total,totalPages}};
}

export function rechargeIdFromTradeNo(outTradeNo) {
  const matched=/^NQPR([1-9]\d{0,14})$/.exec(outTradeNo||'');
  const orderId=matched?Number(matched[1]):0;
  if(!Number.isSafeInteger(orderId)||orderId<=0)throw new Error('RECHARGE_ORDER_NOT_FOUND');
  return orderId;
}

export async function createPointCheckout(userId,points,provider,requestKey,fetchImpl=fetch,paymentMode='qr') {
  if(!['qr','mobile'].includes(paymentMode)||(paymentMode==='mobile'&&provider!=='alipay'))throw new Error('RECHARGE_REQUEST_INVALID');
  if(!pointCheckoutEnabled(userId))throw new Error('RECHARGE_DISABLED');
  const config=provider==='wechat'?wechatPaymentConfig():provider==='alipay'?alipayPaymentConfig():null;
  if(!config)throw new Error('RECHARGE_REQUEST_INVALID');
  const created=createPointRechargeOrder(userId,points,provider,requestKey);
  const order=pointRechargeOrder(created.id,userId);
  if(order.status!=='pending'||order.expires_at-Date.now()<90000)throw new Error('RECHARGE_ORDER_NOT_PAYABLE');
  const checkout=provider==='wechat'?await createWechatNativeOrder(order,config,fetchImpl):paymentMode==='mobile'?createAlipayMobileOrder(order,config):await createAlipayQrOrder(order,config,fetchImpl);
  return {...checkout,points:order.points_units/100,cnyFen:order.cny_fen,cnyFenPerPoint:order.cny_fen_per_usd,currency:'CNY',
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
