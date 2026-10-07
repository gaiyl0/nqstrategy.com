import {NextResponse} from 'next/server';
import { withApiErrors } from '@/lib/api-errors';
import {wechatPaymentConfig} from '@/lib/point-payment-config';
import {readPaymentWebhookBody} from '@/lib/payment-webhook-body.mjs';
import {verifyWechatResponse,decryptWechatNotificationResource} from '@/lib/wechat-pay-crypto.mjs';
import {pointRechargeOrder,rechargeIdFromTradeNo,reconcilePointRecharge} from '@/lib/point-payment-service';

export const dynamic='force-dynamic';

async function POSTHandler(request){
  let config,raw,event,resource;
  try{
    config=wechatPaymentConfig();
    raw=await readPaymentWebhookBody(request);
    verifyWechatResponse({headers:request.headers,body:raw,platformCertificateSerial:config.platformCertificateSerial,
      platformCertificate:config.platformCertificate});
    event=JSON.parse(raw);
    if(event.event_type!=='TRANSACTION.SUCCESS')return NextResponse.json({code:'SUCCESS',message:'ignored'});
    resource=decryptWechatNotificationResource(event.resource,config.apiV3Key);
  }catch{return NextResponse.json({code:'FAIL',message:'invalid payment notification'},{status:400});}
  try{
    const order=pointRechargeOrder(rechargeIdFromTradeNo(resource.out_trade_no));
    if(order.provider!=='wechat'||resource.mchid!==config.merchantId||resource.appid!==config.appId||
      resource.amount?.total!==order.cny_fen||resource.amount?.currency!=='CNY'||
      typeof resource.transaction_id!=='string')throw new Error('RECHARGE_PAYMENT_MISMATCH');
    const result=await reconcilePointRecharge(order,{expectedTradeNo:resource.transaction_id});
    if(!result.paid)throw new Error('RECHARGE_PAYMENT_UNCONFIRMED');
    return NextResponse.json({code:'SUCCESS',message:'ok'});
  }catch{return NextResponse.json({code:'FAIL',message:'payment verification pending'},{status:503});}
}

export const POST = withApiErrors(POSTHandler,{route:'/api/payments/webhooks/wechat-pay'});
