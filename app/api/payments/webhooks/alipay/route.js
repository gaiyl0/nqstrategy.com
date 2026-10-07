import { withApiErrors } from '@/lib/api-errors';
import {alipayPaymentConfig} from '@/lib/point-payment-config';
import {readPaymentWebhookBody} from '@/lib/payment-webhook-body.mjs';
import {verifyAlipayNotification,yuanToFen} from '@/lib/alipay-gateway.mjs';
import {pointRechargeOrder,rechargeIdFromTradeNo,reconcilePointRecharge} from '@/lib/point-payment-service';

export const dynamic='force-dynamic';

async function POSTHandler(request){
  let config,params;
  try{
    config=alipayPaymentConfig();
    const form=new URLSearchParams(await readPaymentWebhookBody(request));
    params={};
    for(const [key,value] of form){if(Object.hasOwn(params,key))throw new Error('ALIPAY_DUPLICATE_FIELD');params[key]=value;}
    verifyAlipayNotification(params,config.publicKey);
    if(params.app_id!==config.appId||params.seller_id!==config.sellerId)throw new Error('ALIPAY_MERCHANT_MISMATCH');
    if(!['TRADE_SUCCESS','TRADE_FINISHED'].includes(params.trade_status))return new Response('success',{headers:{'Content-Type':'text/plain; charset=utf-8'}});
  }catch{return new Response('failure',{status:400,headers:{'Content-Type':'text/plain; charset=utf-8'}});}
  try{
    const order=pointRechargeOrder(rechargeIdFromTradeNo(params.out_trade_no));
    if(order.provider!=='alipay'||yuanToFen(params.total_amount)!==order.cny_fen||!params.trade_no)throw new Error('RECHARGE_PAYMENT_MISMATCH');
    const result=await reconcilePointRecharge(order,{expectedTradeNo:params.trade_no});
    if(!result.paid)throw new Error('RECHARGE_PAYMENT_UNCONFIRMED');
    return new Response('success',{headers:{'Content-Type':'text/plain; charset=utf-8'}});
  }catch{return new Response('failure',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});}
}

export const POST = withApiErrors(POSTHandler,{route:'/api/payments/webhooks/alipay'});
